import type { AgentStep, Projection, RunTimeline, TenantKey, TenantSample } from './types';

/**
 * ⚠️ 에이전트 이벤트는 전부 목업이다. 숫자도 예시값.
 * 실제 Step Functions 실행 이력이 나오면 loadRun() 만 갈아끼우면 화면은 그대로 돈다.
 *
 * 시나리오 — 두 에이전트가 서로 다른 이유로 동시에 돈다.
 *   Agent 1 (쿼터)   올리브영 8/25 세일 → 쿼터 80% 도달 → 투영값이 쿼터 초과 → 노드풀 격리
 *   Agent 2 (장애)   CGV DB 커넥션 포화 알람 → RCA → Tier 2 승인 → rate_limit_fallback
 */

const DURATION = 140_000;

/** ⚠️ 실제 쓰는 Bedrock 모델 ID 로 교체할 것 */
export const MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';
/** 화면에 뜨는 짧은 이름 */
export const MODEL_LABEL = 'Sonnet 4';
/** 단가 가정 — 100만 토큰당 USD. 실제 요금표로 교체 */
export const RATE_PER_M = { in: 3, out: 15 };
const SLO_MS = 300;

const QUOTA: Record<TenantKey, number> = { cgv: 1200, cjenm: 900, oliveyoung: 3600, vips: 600 };
const BASE_QPS: Record<TenantKey, number> = { cgv: 360, cjenm: 240, oliveyoung: 2700, vips: 120 };
const BASE_P99: Record<TenantKey, number> = { cgv: 128, cjenm: 131, oliveyoung: 148, vips: 117 };

const PROJECTION: Projection = {
  tenant: 'oliveyoung',
  currentRps: 2880,
  quota: 3600,
  horizonMin: 30,
  slopePerMin: 36,
  trendRps: 3960,   // 2,880 + 36 × 30
  eventRps: 4000,   // baseline 1,200 × 예상배수 3.2 × 보정 1.04
  expectedRps: 4000,
  needRps: 400,
  poolFreeRps: 870,
};

/** 집행(t=48s) 전후 쿼터 — 총 파이 6,300 rps 는 변하지 않는다 (zero-sum) */
const QUOTA_AFTER: Record<TenantKey, number> = { cgv: 900, cjenm: 800, oliveyoung: 4000, vips: 600 };
const REBALANCE_AT = 48_000;

function jitter(seed: number, amp: number): number {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * amp;
}
const lerp = (a: number, b: number, r: number) => a + (b - a) * Math.min(1, Math.max(0, r));

function oliveQps(t: number): number {
  if (t < 8_000) return lerp(2700, 2880, t / 8_000);
  if (t < 36_000) return lerp(2880, 3280, (t - 8_000) / 28_000);
  return lerp(3280, 3380, (t - 36_000) / 100_000);
}

function cgvP99(t: number): number {
  if (t < 44_000) return BASE_P99.cgv;
  if (t < 100_000) return lerp(BASE_P99.cgv, 780, (t - 44_000) / 56_000);
  if (t < 118_000) return lerp(780, 150, (t - 104_000) / 14_000);
  return 148;
}

function buildSamples(): TenantSample[] {
  const out: TenantSample[] = [];
  for (let t = 0; t <= DURATION; t += 1000) {
    const i = t / 1000;
    out.push({
      t,
      qps: {
        cgv: Math.round(BASE_QPS.cgv + jitter(i + 1, 14)),
        cjenm: Math.round(BASE_QPS.cjenm + jitter(i + 2, 12)),
        oliveyoung: Math.round(oliveQps(t)),
        vips: Math.round(BASE_QPS.vips + jitter(i + 3, 8)),
      },
      p99: {
        cgv: Math.round(cgvP99(t) + jitter(i + 4, 12)),
        cjenm: Math.round(BASE_P99.cjenm + jitter(i + 5, 6)),
        oliveyoung: Math.round(BASE_P99.oliveyoung + jitter(i + 6, 7)),
        vips: Math.round(BASE_P99.vips + jitter(i + 7, 5)),
      },
      quotaLimit: t < REBALANCE_AT ? QUOTA : QUOTA_AFTER,
      leading: {
        connPoolPct: Math.round(t < 40_000 ? 62 : t < 64_000 ? lerp(62, 96, (t - 40_000) / 24_000) : t < 110_000 ? 96 : lerp(96, 68, (t - 110_000) / 20_000)),
        threadQueue: Math.round(t < 50_000 ? 18 : t < 70_000 ? lerp(18, 280, (t - 50_000) / 20_000) : t < 110_000 ? 280 : lerp(280, 24, (t - 110_000) / 16_000)),
        connWaitSlope: Number((t < 40_000 ? 0.4 : t < 68_000 ? lerp(0.4, 7.9, (t - 40_000) / 28_000) : t < 110_000 ? 7.9 : 0.6).toFixed(1)),
        hpaReplicas: t < 48_000 ? 6 : t < 70_000 ? 9 : t < 112_000 ? 10 : 7,
      },
    });
  }
  return out;
}

const STEPS: AgentStep[] = [
  /* ── Agent 1 · 쿼터 재분배 (최종 문서 기준) ────────────
     LLM 은 '조합 선택' 단 한 곳에만 들어간다. 나머지는 전부 결정론. */
  {
    id: 'q-trigger', t: 8_000, agent: 'quota', phase: 'monitor',
    state: 'trigger', executor: 'code',
    title: '트리거 — 사용률 80% 초과 지속',
    detail: '관측 축은 RPS 단일. 중복 발화는 quota-locks(TTL) + 쿨다운으로 흡수한다.',
    payload: { lines: ['oliveyoung  2,880 / 3,600 rps  =  80.0%  (2분 지속)'] },
  },
  {
    id: 'q-fetch', t: 11_000, agent: 'quota', phase: 'monitor',
    state: 'fetch_signals', executor: 'code',
    title: '데이터 3종 조회',
    payload: {
      lines: [
        '① 추세      AMP(Prometheus)              최근 기울기 +36 rps/분',
        '② 이벤트    DynamoDB cjone-business-events  올리브영 8/25 세일 · 예상배수 3.2',
        '③ 과거실측  S3 장기보관 → Athena          작년 동일 세일 실측/예상 = 1.04 → 보정',
      ],
    },
  },
  {
    id: 'q-need', t: 15_000, agent: 'quota', phase: 'monitor',
    state: 'compute_need', executor: 'code',
    title: '필요량 산출',
    detail: '추세와 이벤트 두 투영을 각각 구해 큰 쪽을 택한다 — 보수적으로.',
    payload: PROJECTION,
  },
  {
    id: 'q-pool', t: 19_000, agent: 'quota', phase: 'monitor',
    state: 'check_pool', executor: 'code',
    title: '파이 안에서 조달 가능한가',
    payload: {
      lines: [
        '필요량            400 rps',
        '전체 파이 여유    870 rps  (도너 3곳 합)',
        '→ 조달 가능 · 재분배 진행',
        '※ 초과였다면 스케일링 에스컬레이션 — 여기서 AI 는 손을 뗀다 (zero-sum)',
      ],
    },
  },
  {
    id: 'q-donors', t: 25_000, agent: 'quota', phase: 'diagnose',
    state: 'build_candidates', executor: 'code',
    title: '도너별 줄 수 있는 양 + 위험도',
    detail: '"지금 남는 양"과 "내줄 수 있는 양"은 다르다. 도너의 미래 필요분을 먼저 뺀다.',
    payload: {
      donors: [
        { name: 'CGV', quota: 1200, future: 900, giveable: 300, risk: 22, note: '이벤트 없음 · 변동성 낮음' },
        { name: 'CJ ENM', quota: 900, future: 750, giveable: 150, risk: 38, note: '완만한 상승 추세' },
        { name: 'VIPS', quota: 600, future: 180, giveable: 420, risk: 81, note: '3시간 뒤 예약 오픈 · 변동성 높음' },
      ],
    },
  },
  {
    id: 'q-combo', t: 32_000, agent: 'quota', phase: 'diagnose',
    state: 'select_combination', executor: 'llm',
    model: MODEL_ID, tokens: { in: 3180, out: 420 },
    title: '조합 선택 — 이 파이프라인에서 유일한 LLM 개입',
    detail: '세 조합 모두 산술적으로 맞다. 영향받는 테넌트 수와 도너 위험도를 맞바꾸는 판단이라 단일 수식으로 고정할 수 없다.',
    payload: {
      combos: [
        { label: 'VIPS 단독 400', total: 400, chosen: false, reason: '위험도 81 — 3시간 뒤 예약 오픈. 방금 푼 문제를 옆에서 다시 만든다' },
        { label: 'CGV 300 + CJ ENM 100', total: 400, chosen: true, reason: '위험도 낮은 순 · 도너 2곳으로 영향 범위 최소' },
        { label: 'CGV 300 + CJ ENM 50 + VIPS 50', total: 400, chosen: false, reason: '도너 3곳 — 영향 테넌트만 늘고 위험도 이득 없음' },
      ],
      note: '후보 표 안에서 배분만 시킨다. 모델이 새 숫자를 만들지 못한다.',
      fallback: '모델 호출 실패 시 위험도 오름차순 그리디로 폴백 · 폴백 사실은 기록에 남긴다',
    },
  },
  {
    id: 'q-verify', t: 38_000, agent: 'quota', phase: 'diagnose',
    state: 'validate', executor: 'code',
    title: '검증 — 어기면 무조건 틀린 것만',
    detail: '검증에까지 AI 를 넣으면 불확실한 단계를 하나 더 쌓는 꼴이다. 여기는 규칙만 건다.',
    payload: {
      checks: [
        { n: '①', label: '합계 = 필요량 400 rps', ok: true },
        { n: '②', label: '도너 잔여 ≥ SLA 하한', ok: true, note: 'CGV 900≥600 · ENM 800≥500' },
        { n: '③', label: '줄 수 있는 양 초과 없음', ok: true },
        { n: '④', label: '총 파이 불변 (zero-sum)', ok: true, note: '6,300 rps' },
        { n: '⑤', label: '후보 밖 · 자기자신 · 중복 도너 아님', ok: true },
      ],
      footer: '하나라도 어기면 집행하지 않는다.',
    },
  },
  {
    id: 'q-hitl', t: 44_000, agent: 'quota', phase: 'act',
    state: 'check_approval', executor: 'code',
    title: '사람 승인이 필요한가 — 기본은 자동',
    detail: '테넌트 56개에 몇 초 간격 알림을 사람이 매번 클릭할 수는 없다. 잘못 집행되면 그쪽에서 다시 트리거가 발화해 스스로 교정된다.',
    payload: {
      lines: [
        '수혜 테넌트 변동률   400 / 3,600 = 11.1%   ≤ 25%   통과',
        '도너 수              2곳                   < 4곳   통과',
        '→ 자동 집행 (Slack 승인 불필요)',
      ],
    },
  },
  {
    id: 'q-apply', t: 48_000, agent: 'quota', phase: 'act',
    state: 'manage_limits.py', executor: 'exec',
    title: '집행 — AI 미개입',
    payload: {
      lines: [
        'oliveyoung  3,600 → 4,000    cgv  1,200 → 900    cjenm  900 → 800',
        '한도 config 갱신 → ConfigMap → hot-reload',
        '한도는 config · 사용량은 Redis 카운터 · 총 파이 6,300 rps 불변',
      ],
    },
  },
  {
    id: 'q-record', t: 76_000, agent: 'quota', phase: 'improve',
    state: 'quota-decisions', executor: 'code',
    title: '조치 이력 저장',
    detail: '무엇을·왜·언제. 사후 배치 분석과 정확도 평가의 원천이 된다.',
    payload: {
      lines: [
        'DynamoDB quota-decisions  ·  quota-state 갱신  ·  quota-locks 해제',
        'llm_fallback = false  (모델 정상 응답)',
      ],
    },
  },

  /* ── Agent 2 · 장애 대응 (최종 아키텍처) ────────────────
     제어는 Step Functions 가 세 단계를 순서대로 호출 — 제어 계층엔 LLM 없음.
     LLM 은 진단 · 조치 · 티어 판정 세 곳. 전처리와 검증은 코드가 소유한다. */
  {
    id: 'i-sqs', t: 40_000, agent: 'incident', phase: 'monitor',
    state: 'SQS incident-alerts', executor: 'code',
    title: '알람 수신 — 3소스',
    payload: {
      lines: [
        'AMP Alertmanager   cgv · DBConnectionSaturation · P99 3s',
        'CloudWatch Alarm   RDS 커넥션 사용률 임계 초과',
        '정적 알람          해당 없음 (OOMKill · CrashLoop)',
      ],
    },
  },
  {
    id: 'i-norm', t: 43_000, agent: 'incident', phase: 'monitor',
    state: '전처리 Lambda · 1 정규화', executor: 'code',
    title: '소스별 페이로드를 단일 스키마로',
    detail: 'LLM 이 없는 이유 — 형식 통일 · 중복 제거 · 조회는 정답이 하나다. 코드가 소유한다.',
    payload: { lines: ['{ source, tenant, service, symptom, metric, value, threshold, fired_at }'] },
  },
  {
    id: 'i-dedupe', t: 45_000, agent: 'incident', phase: 'monitor',
    state: '전처리 Lambda · 2 중복 체크', executor: 'code',
    title: '같은 서비스 · 테넌트가 진행 중인가',
    payload: { lines: ['진행 중 인시던트 없음 → 신규 생성', '있었다면 기존 인시던트에 병합하고 종료'] },
  },
  {
    id: 'i-collect', t: 48_000, agent: 'incident', phase: 'monitor',
    state: '전처리 Lambda · 3 데이터 수집', executor: 'code',
    title: '배포 이력 · 에러 로그',
    payload: {
      lines: [
        'ArgoCD   최근 배포 없음 (마지막 4h 전 · rev a91c2f)',
        'Loki     최근 5분 ERROR 1,284건',
        'Loki     대표 메시지 "connection pool exhausted" 외 4개',
      ],
    },
  },
  {
    id: 'i-prompt', t: 50_000, agent: 'incident', phase: 'monitor',
    state: '전처리 Lambda · 4 프롬프트 제작', executor: 'code',
    title: '정형 템플릿',
    detail: '왜 Step Functions 가 아니라 Lambda 하나인가 — 정규화→중복체크→수집→프롬프트는 분기 없는 직렬 작업이다. SFN 은 단계 사이에만 있다.',
    payload: { lines: ['[정규화된 트리거] + [수집 데이터] + [출력 스키마 지시]'] },
  },
  {
    id: 'i-diag', t: 56_000, agent: 'incident', phase: 'diagnose',
    state: '진단 에이전트 (Bedrock)', executor: 'llm',
    model: MODEL_ID, tokens: { in: 18600, out: 2240 },
    title: '도구를 스스로 골라 호출 → 결과 관찰 → 재호출',
    detail: '정해진 원인 목록 없이 자유 도출한다. 고정하는 것은 출력 JSON 스키마뿐.',
    payload: {
      tools: [
        { name: 'query_metrics', src: 'AMP · K8s 메트릭 150일', calls: 2 },
        { name: 'query_cloudwatch', src: 'RDS · ALB · NAT', calls: 2 },
        { name: 'query_logs', src: 'Loki', calls: 1 },
        { name: 'get_flows', src: 'Hubble · 테넌트 간 흐름', calls: 1 },
        { name: 'get_history', src: 'DynamoDB · 과거 조치 이력', calls: 1 },
      ],
      idle: ['query_traces', 'get_deploys', 'get_pods'],
      total: 7,
    },
  },
  {
    id: 'i-json', t: 64_000, agent: 'incident', phase: 'diagnose',
    state: '출력 JSON (스키마 고정)', executor: 'llm',
    title: 'CGV가 5분 전 RPS가 올랐고, 그 이후 공용 커넥션 풀 78%를 점유해 커넥션 풀 소진이 발생하고 있다',
    payload: {
      tenant: 'cgv',
      occurred_at: '19:12:04',
      symptom: '커넥션 풀 소진 · P99 3s',
      direct_cause: '공용 RDS 커넥션 풀 78% 를 cgv 가 점유',
      root_cause: 'cgv RPS 급증 → HPA 스케일아웃 → 파드당 커넥션 × 레플리카가 상한 근접',
      evidence: [
        'query_metrics   cgv RPS 360 → 1,180 (5분 전)',
        'query_cloudwatch DatabaseConnections 96% · 대기 커넥션 41',
        'query_logs      "connection pool exhausted" 1,284건',
        'get_flows       타 테넌트 → RDS 흐름 변화 없음',
        'get_history     동일 증상 3건 · RB-05+RB-03 로 해소 2건',
      ],
      tool_calls: '7회 · 5종',
    },
  },
  {
    id: 'i-verify', t: 70_000, agent: 'incident', phase: 'diagnose',
    state: '검증 Lambda (결정론)', executor: 'code',
    title: '신뢰도는 모델에게 묻지 않는다',
    detail: '평가받을 대상에게 몇 점 같냐고 묻지 않는다. 신뢰도는 도구 호출 기록이라는 사실로 계산한다.',
    payload: {
      checks: [
        { n: '①', label: 'JSON 스키마 검사', ok: true },
        { n: '②', label: '정당한 추론인가 — 도구 호출 횟수 · 종류로 신뢰도 산출', ok: true, note: '7회 · 5종 → 0.82' },
      ],
      footer: 'LLM 자가 confidence 는 쓰지 않는다. 신뢰 불가면 재진단 1회(도구 추가 조회 지시), 2회 실패면 사람에게 보고하고 중단한다.',
    },
  },
  {
    id: 'i-plan', t: 78_000, agent: 'incident', phase: 'act',
    state: '조치 에이전트 (Bedrock)', executor: 'llm',
    model: MODEL_ID, tokens: { in: 6900, out: 780 },
    title: '이 원인을 없애려면 무엇을 해야 하는가',
    payload: {
      expected: 'P99 300ms 이내 · 공용 풀 사용률 60% 이하',
      milestones: ['2분 내 대기 커넥션 0', '5분 내 P99 회복'],
      plan: [
        { id: 'RB-05', name: '슬로우 쿼리 세션 종료', param: '실행 30초 초과 세션' },
        { id: 'RB-03', name: '테넌트 RPS 스로틀 (Cilium CEC)', param: 'cgv 360 → 260 rps' },
      ],
      monitorSec: 600,
    },
  },
  {
    id: 'i-catalog', t: 84_000, agent: 'incident', phase: 'act',
    state: '카탈로그 조합으로 답이 나오나', executor: 'code',
    title: '런북 카탈로그 — 조치 1개 = 런북 1개 = 최소 권한',
    detail: '런북이 리소스 두 개를 만지면 권한도 둘 다 열린다. 최소 권한을 지키려면 쪼개고, 필요하면 조합한다.',
    payload: {
      catalog: [
        { id: 'RB-01', name: 'HPA 레플리카 상향' }, { id: 'RB-02', name: '파드 롤링 재시작' },
        { id: 'RB-03', name: '테넌트 RPS 스로틀', chosen: true }, { id: 'RB-04', name: 'RDS Proxy 커넥션 풀 조정' },
        { id: 'RB-05', name: '슬로우 쿼리 세션 종료', chosen: true }, { id: 'RB-06', name: '노드풀 격리' },
        { id: 'RB-07', name: '노드 cordon' }, { id: 'RB-08', name: 'ArgoCD 롤백' },
        { id: 'RB-09', name: 'limit 상향' }, { id: 'RB-10', name: '통보' },
        { id: 'RB-11', name: '무조치' }, { id: 'RB-12', name: '핸드오프' },
      ],
      note: '미매칭이었다면 런북 직접 제작 → 무조건 T3 (HITL + 보고서). 승인·실행되면 카탈로그에 적립해 다음엔 조합 경로로 처리한다.',
    },
  },
  {
    id: 'i-tier', t: 90_000, agent: 'incident', phase: 'act',
    state: '티어 판정 (AI)', executor: 'llm',
    model: MODEL_ID, tokens: { in: 2100, out: 160 },
    title: 'T2 — HITL',
    detail: '장애 등급 × 런북 조합 위험도 × 출처(기존 / 직접 제작)',
    payload: {
      lines: [
        '장애 등급         높음 — 부분 실패 (P99 3s · 5xx 발생)',
        '런북 조합 위험도  높음 — 세션 종료 포함',
        '출처              기존 런북 (카탈로그)',
        '→ T2 · Slack 승인 · 타임아웃 600초',
      ],
    },
  },
  {
    id: 'i-hitl', t: 96_000, agent: 'incident', phase: 'act',
    state: 'HITL — Slack 승인', executor: 'code',
    title: '600초 내 승인',
    detail: '완전 자동화가 목표가 아니다. 승인 버튼을 누를 수 있는 상태까지 자동으로 만드는 게 범위다.',
    payload: {
      lines: [
        '@yuhyun 승인 · 42초',
        '타임아웃이었다면 실행하지 않는다 — 이력만 기록하고 사람에게 통보',
      ],
    },
  },
  {
    id: 'i-exec', t: 104_000, agent: 'incident', phase: 'act',
    state: '런북 executor Lambda', executor: 'exec',
    title: 'EKS 집행 — 가드레일은 롤백이 아니라 사전 수립',
    detail: '서비스 최소 가용 구간은 AI 불가침. Kyverno 정책이 executor 보다 먼저 막는다.',
    payload: {
      lines: [
        '권한 분리       IAM · K8s RBAC (런북별 최소 권한)',
        'Kyverno 사전 가드레일   통과',
        '집행            RB-05 슬로우 쿼리 세션 종료 → RB-03 Cilium CEC RPS 스로틀',
      ],
    },
  },
  {
    id: 'i-watch', t: 112_000, agent: 'incident', phase: 'act',
    state: '모니터링 Lambda', executor: 'code',
    title: '마일스톤 순서대로 확인',
    payload: {
      checks: [
        { n: 'M1', label: '2분 내 대기 커넥션 0', ok: true, note: '+118s · 0건' },
        { n: 'M2', label: '5분 내 P99 회복', ok: true, note: '+130s · 148ms' },
        { n: '결과', label: '예상 결과 도달 — P99 300ms 이내 · 풀 60% 이하', ok: true },
      ],
      footer: '미도달이면 진단으로 되돌려 재진단 1회. 2회째면 사람에게 에스컬레이션한다.',
    },
  },
  {
    id: 'i-record', t: 132_000, agent: 'incident', phase: 'improve',
    state: '종료 · DynamoDB 이력 기록', executor: 'code',
    title: '장애 · 조치 이력 저장 · Slack 보고',
    payload: { lines: ['DynamoDB 장애·조치 이력 기록', 'Slack 보고 — T1 자동 실행 건도 사후 보고 대상'] },
  },
];

const CAVEATS = [
  '에이전트 이벤트는 전부 목업 — 실제 Step Functions 실행 이력 연결 전',
  'SLO 임계값(300ms)은 SLI/SLO 설계 문서 확정치 반영 전',
  'Agent 1 의 스케일링 에스컬레이션 분기는 이번 시연 경로에 없음',
];

export function buildMockRun(): RunTimeline {
  return {
    runId: 'sfn-2608-0417',
    durationMs: DURATION,
    sloMs: SLO_MS,
    tenantTotal: 56,
    projection: PROJECTION,
    steps: [...STEPS].sort((a, b) => a.t - b.t),
    samples: buildSamples(),
    caveats: CAVEATS,
  };
}

export async function loadRun(): Promise<RunTimeline> {
  const source = import.meta.env.VITE_AGENT_SOURCE ?? 'mock';
  const url = import.meta.env.VITE_AGENT_EVENTS_URL as string | undefined;
  if (source === 'live' && url) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as RunTimeline;
    console.warn('[cjone] live 에이전트 이벤트를 못 읽어서 mock 으로 떨어짐');
  }
  return buildMockRun();
}
