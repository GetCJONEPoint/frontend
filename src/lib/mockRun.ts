import type { AgentStep, Projection, RunTimeline, TenantKey, TenantSample } from './types';

/**
 * ⚠️ 에이전트 이벤트는 전부 목업이다. 숫자도 예시값.
 * 실제 Step Functions 실행 이력이 나오면 loadRun() 만 갈아끼우면 화면은 그대로 돈다.
 *
 * Agent 1 과 Agent 2 는 완전히 별개 상황이다 — 타임라인 · 시계 · 데이터를 공유하지 않는다.
 * 발표에서 두 시연을 각각 따로 녹화하므로, 한 에이전트의 화면·대사가 다른 에이전트를 가리키면 안 된다.
 *
 * Agent 1 (쿼터 축 · 예방적) — 추석 연휴 직후 CJ 대한통운 택배 물량 폭주
 *   연휴엔 주문은 쌓이는데 배송이 안 나간다. 연휴가 끝나면 적체분이 한꺼번에 배송완료되고,
 *   배송완료 즉시 보낸 사람에게 CJ ONE 포인트가 적립된다. 적립 RPS 가 쿼터 80% 도달 → 파이 안에서 재분배.
 *
 * Agent 2 (이상탐지 · 사후적) — 대한통운(oliveyoung)이 전용 노드풀로 격리된 뒤에도 데이터 계층(Aurora ·
 *   RDS Proxy)은 여전히 공유다. 그 위에서 CJ 온스타일(cgv)이 라이브 커머스 방송을 시작해 적립 쓰기가
 *   몰리며 공용 풀이 소진된다 — 뚜레쥬르(cjenm) · VIPS(vips) 도 함께 느려진다. Agent 1 의 사건과는
 *   무관한 별개 상황이다 (같은 인프라 배경만 공유할 뿐, 트리거·원인·조치는 전혀 다르다).
 *
 * ⚠️ 코드 키(cgv/cjenm/oliveyoung)는 백엔드 tenantId 계약이라 그대로 두고,
 *    화면 표시는 TENANTS[key].label 로만 바꾼다. 설정 출력 줄의 id 는 새 브랜드 기준으로 적었다.
 */

/** 두 에이전트는 완전히 별개 상황이다. 타임라인도 시계도 데이터도 따로 돈다. */
const DURATION_Q = 90_000;    // Agent 1 — 추석 연휴 직후 물량 폭주
const DURATION_I = 80_000;    // Agent 2 — 격리 후에도 남는 공유 자원 문제 (Agent 1 과 무관)

/** ⚠️ 실제 쓰는 Bedrock 모델 ID 로 교체할 것 */
export const MODEL_ID = 'anthropic.claude-sonnet-4-20250514-v1:0';
/** 화면에 뜨는 짧은 이름 */
export const MODEL_LABEL = 'Sonnet 4';
/** 단가 가정 — 100만 토큰당 USD. 실제 요금표로 교체 */
export const RATE_PER_M = { in: 3, out: 15 };
const SLO_MS = 300;
/** Agent 2 전용 SLO — 이번 시나리오는 1초 기준(Agent 1의 300ms와 다르다) */
const SLO_MS_INCIDENT = 1_000;

const QUOTA: Record<TenantKey, number> = { cgv: 1200, cjenm: 900, oliveyoung: 3600, vips: 600 };
const BASE_QPS: Record<TenantKey, number> = { cgv: 360, cjenm: 240, oliveyoung: 2700, vips: 120 };
const BASE_P99: Record<TenantKey, number> = { cgv: 128, cjenm: 131, oliveyoung: 142, vips: 117 };

const PROJECTION: Projection = {
  tenant: 'oliveyoung',
  currentRps: 2880,
  quota: 3600,
  horizonMin: 30,
  slopePerMin: 72,   // 평시 트리거 대비 3.1배 — 기울기가 가파르다
  trendRps: 5040,    // 2,880 + 72 × 30
  eventRps: 5600,    // baseline 1,250 × 적체 예상배수 4.3 × 보정 1.04
  expectedRps: 5600,
  needRps: 2000,
  poolFreeRps: 870,  // 도너 3곳을 다 합쳐도 이만큼뿐
};

/** Agent 2 는 projection 기반 투영을 쓰지 않는다 (트리거가 쿼터%가 아니라 이상탐지 알람이라서).
 *  RunTimeline 타입이 projection 필드를 요구해서 채워둔 값일 뿐 — tenant 만 HitlPopup 표시에 쓰이고,
 *  나머지 숫자는 전부 0 이며 화면(Slot)은 agent === 'quota' 일 때만 이 값을 그린다. */
const INCIDENT_PROJECTION: Projection = {
  tenant: 'cgv', // CJ ONSTYLE — 이번 사건의 발화 테넌트 (HitlPopup 표시에만 쓰인다)
  currentRps: 0,
  quota: 0,
  horizonMin: 0,
  slopePerMin: 0,
  trendRps: 0,
  eventRps: 0,
  expectedRps: 0,
  needRps: 0,
  poolFreeRps: 0,
};

/** 노드풀 격리(t=38s · 진단 종료 = 조치 시작) 전후 쿼터.
 *  재분배가 아니라 파이 자체를 키우는 분기라 도너 쿼터는 그대로다. */
const QUOTA_AFTER: Record<TenantKey, number> = { cgv: 1200, cjenm: 900, oliveyoung: 5600, vips: 600 };
const REBALANCE_AT = 38_000;

/** Agent 1 트리아지에서 조회하는 비즈니스 스케줄 이력 — 과거 실측(왼쪽) / 이번 주(오른쪽) */
export interface ScheduleRow { when: string; name: string; note: string; tag?: string; hot?: boolean; dim?: boolean }
export const BUSINESS_EVENTS: { title: string; sub: string; rows: ScheduleRow[] }[] = [
  {
    title: '2025',
    sub: 'S3 장기보관 → Athena',
    rows: [
      { when: '25/10/03 – 10/06', name: '추석 연휴', note: '배송 중단' },
      { when: '25/10/07', name: '연휴 종료 익일', note: '노드풀 공유 테넌트 동반 지연', tag: '장애 1건', hot: true },
      { when: '실측 / 예상', name: '1.04', note: '보정계수', tag: '보정' },
    ],
  },
  {
    title: '2026',
    sub: '추세 +72 rps/분 · 평시 3.1배',
    rows: [
      { when: '9/24 – 9/27', name: '추석 연휴', note: '배송 중단 · 주문 적체' },
      { when: '9/28  오늘', name: '연휴 종료 익일', note: '적체분 일괄 배송완료', tag: '예상배수 ×3.2', hot: true },
      { when: '10/03 – 10/05', name: '개천절 연휴', note: '동일 패턴 재발 예상', dim: true },
    ],
  },
];

/** 30분 지평 투영 — 맨 위 파선이 임계점(대한통운 쿼터) */
export const FORECAST = {
  horizonMin: 30,
  threshold: QUOTA.oliveyoung,
  yMax: 6200,
  series: [
    { tenant: 'oliveyoung' as TenantKey, from: 2880, to: 5600 },
    { tenant: 'cgv' as TenantKey, from: 360, to: 385 },
    { tenant: 'cjenm' as TenantKey, from: 240, to: 305 },
    { tenant: 'vips' as TenantKey, from: 120, to: 132 },
  ],
  /** 트리아지 구간에서 선이 그려진다 */
  drawFrom: 8_000,
  drawTo: 19_000,
};

function jitter(seed: number, amp: number): number {
  return ((Math.sin(seed * 12.9898) * 43758.5453) % 1) * amp;
}
const lerp = (a: number, b: number, r: number) => a + (b - a) * Math.min(1, Math.max(0, r));

/** 적체분이 순차로 배송완료되며 적립 요청이 계속 오른다 */
function quotaRunQps(t: number): number {
  if (t < 8_000) return lerp(2700, 2880, t / 8_000);
  if (t < 44_000) return lerp(2880, 3520, (t - 8_000) / 36_000);
  if (t < 112_000) return lerp(3520, 4850, (t - 44_000) / 68_000);
  return lerp(4850, 5100, (t - 112_000) / 38_000);
}

/** 재분배로 통과량이 늘자 커넥션 풀이 상한에 닿고 적립 지연이 2 초대로 뛴다 */
function quotaRunP99(t: number): number {
  if (t < 44_000) return BASE_P99.oliveyoung;
  if (t < 112_000) return lerp(BASE_P99.oliveyoung, 2150, (t - 44_000) / 68_000);
  if (t < 132_000) return lerp(2150, 160, (t - 112_000) / 20_000);
  return 155;
}

function buildSamples(
  duration: number,
  qps: (t: number) => number,
  p99: (t: number) => number,
  quotaAt: (t: number) => Record<TenantKey, number>,
): TenantSample[] {
  const out: TenantSample[] = [];
  for (let t = 0; t <= duration; t += 1000) {
    const i = t / 1000;
    out.push({
      t,
      qps: {
        cgv: Math.round(BASE_QPS.cgv + jitter(i + 1, 14)),
        cjenm: Math.round(BASE_QPS.cjenm + jitter(i + 2, 12)),
        oliveyoung: Math.round(qps(t)),
        vips: Math.round(BASE_QPS.vips + jitter(i + 3, 8)),
      },
      p99: {
        cgv: Math.round(BASE_P99.cgv + jitter(i + 4, 10)),
        cjenm: Math.round(BASE_P99.cjenm + jitter(i + 5, 6)),
        oliveyoung: Math.round(p99(t) + jitter(i + 6, 14)),
        vips: Math.round(BASE_P99.vips + jitter(i + 7, 5)),
      },
      quotaLimit: quotaAt(t),
      leading: {
        connPoolPct: Math.round(t < 20_000 ? 62 : t < 50_000 ? lerp(62, 96, (t - 20_000) / 30_000) : t < 68_000 ? 96 : lerp(96, 64, (t - 68_000) / 18_000)),
        threadQueue: Math.round(t < 24_000 ? 18 : t < 56_000 ? lerp(18, 310, (t - 24_000) / 32_000) : t < 68_000 ? 310 : lerp(310, 22, (t - 68_000) / 18_000)),
        connWaitSlope: Number((t < 20_000 ? 0.4 : t < 56_000 ? lerp(0.4, 8.3, (t - 20_000) / 36_000) : t < 68_000 ? 8.3 : 0.6).toFixed(1)),
        hpaReplicas: t < 24_000 ? 6 : t < 40_000 ? 9 : t < 68_000 ? 10 : 7,
      },
    });
  }
  return out;
}

/* Agent 2 — 자체 곡선. Agent 1 과 아무 관계 없다.
 * 시나리오 — CJ 대한통운(oliveyoung)이 전용 노드풀로 격리된 뒤에도 데이터 계층(Aurora · RDS Proxy)은
 * 여전히 공유다. 대한통운의 밀린 적립 쓰기 부하가 그 공용 풀을 이미 눌러놓은 상태에서,
 * CJ 온스타일(cgv)이 라이브 커머스 방송을 시작해 적립 쓰기가 몰리며 풀이 터진다.
 * 같은 풀을 쓰는 뚜레쥬르(cjenm) · VIPS(vips) 도 함께 느려진다 — 네 테넌트 모두 원인의 일부다. */

/** CJ 온스타일 — 방송 시작 2초 후부터 적립 RPS 가 치솟는다 */
function onstyleQps(t: number): number {
  if (t < 2_000) return BASE_QPS.cgv;
  if (t < 27_000) return lerp(BASE_QPS.cgv, 940, (t - 2_000) / 25_000);
  if (t < 65_000) return 940;
  if (t < 83_000) return lerp(940, 420, (t - 65_000) / 18_000);
  return 380;
}
/** CJ 온스타일 — 적립 P99. 동적 베이스라인(168/182ms)은 방송 시작 2.6초 만에, 정적 임계값(500ms)은 6초 만에 넘는다 */
function onstyleP99(t: number): number {
  if (t < 2_000) return BASE_P99.cgv;
  if (t < 27_000) return lerp(BASE_P99.cgv, 2_400, (t - 2_000) / 25_000);
  if (t < 65_000) return 2_400;
  if (t < 83_000) return lerp(2_400, 175, (t - 65_000) / 18_000);
  return 168;
}
/** 같은 RDS Proxy 를 쓰는 나머지 테넌트 — 콜래터럴 지연. base → peak → base 로 되돌아온다 */
function collateralP99(base: number, peak: number, t: number): number {
  if (t < 5_000) return base;
  if (t < 30_000) return lerp(base, peak, (t - 5_000) / 25_000);
  if (t < 65_000) return peak;
  if (t < 83_000) return lerp(peak, base + 12, (t - 65_000) / 18_000);
  return base + 8;
}
/** 대한통운 — 이미 격리된 노드풀에서 안정 운영 중이지만, 밀린 적립 쓰기가 공용 풀을 계속 누른다 */
function daehanP99(t: number): number { return collateralP99(300, 480, t); }
function tousP99(t: number): number { return collateralP99(BASE_P99.cjenm, 1_180, t); }
function vipsP99(t: number): number { return collateralP99(BASE_P99.vips, 1_120, t); }

/** 공유 RDS Proxy 자체의 상태 — 네 테넌트가 공통으로 겪는 원인 지표 */
function incidentLeading(t: number) {
  const connPoolPct = t < 5_000 ? 60
    : t < 35_000 ? lerp(60, 97, (t - 5_000) / 30_000)
    : t < 65_000 ? 97
    : lerp(97, 58, (t - 65_000) / 18_000);
  const threadQueue = t < 5_000 ? 40
    : t < 35_000 ? lerp(40, 340, (t - 5_000) / 30_000)
    : t < 65_000 ? 340
    : lerp(340, 45, (t - 65_000) / 18_000);
  const connWaitSlope = Number((t < 5_000 ? 0.4
    : t < 35_000 ? lerp(0.4, 9.1, (t - 5_000) / 30_000)
    : t < 65_000 ? 9.1
    : lerp(9.1, 0.6, (t - 65_000) / 18_000)).toFixed(1));
  const hpaReplicas = t < 10_000 ? 6 : t < 27_000 ? 10 : t < 65_000 ? 10 : 7;
  return { connPoolPct: Math.round(connPoolPct), threadQueue: Math.round(threadQueue), connWaitSlope, hpaReplicas };
}

function buildIncidentSamples(duration: number): TenantSample[] {
  const out: TenantSample[] = [];
  for (let t = 0; t <= duration; t += 1000) {
    const i = t / 1000;
    out.push({
      t,
      qps: {
        cgv: Math.round(onstyleQps(t) + jitter(i + 1, 10)),
        cjenm: Math.round(BASE_QPS.cjenm + jitter(i + 2, 12)),
        oliveyoung: Math.round(1_900 + jitter(i + 3, 60)),
        vips: Math.round(BASE_QPS.vips + jitter(i + 4, 8)),
      },
      p99: {
        cgv: Math.round(onstyleP99(t) + jitter(i + 5, 14)),
        cjenm: Math.round(tousP99(t) + jitter(i + 6, 8)),
        oliveyoung: Math.round(daehanP99(t) + jitter(i + 7, 12)),
        vips: Math.round(vipsP99(t) + jitter(i + 8, 6)),
      },
      quotaLimit: QUOTA_AFTER, // 대한통운은 Agent 1 에서 이미 5,600 으로 격리된 뒤 — 이 run 은 그 이후 시점
      leading: incidentLeading(t),
    });
  }
  return out;
}

/* ── Agent 2 탐지 · 동적 베이스라인 계열 ──────────────
   run 샘플(0초부터, 1초 간격)만으로는 탐지 화면에서 두 가지를 못 보여준다.
   ① "동적" 베이스라인이 시간에 따라 다시 계산되며 움직인다는 것 — 보여줄 과거 구간이 없다.
   ② 8초짜리 이탈 — 80초 축에 얹으면 왼쪽 끝에 뭉개진다.
   그래서 알람 직전 12초까지 되감은 0.5초 간격 계열을 따로 만든다. 축이 달라 run 샘플과
   섞지 않고 탐지 카드만 이걸 쓴다. */
export const DETECT_LEAD_MS = 12_000;              // 알람 이전 · 평상시 구간
export const DETECT_SPAN_MS = DETECT_LEAD_MS + 8_000; // 탐지 단계는 t=8초에 끝난다
export const DETECT_AMP_BASE = 168;
export const DETECT_CW_BASE = 182;
export const DETECT_STATIC_MS = 500;

export interface DetectPoint {
  /** run 기준 시각(ms). 음수 = 알람 이전 */
  t: number;
  /** CJ 온스타일 적립 P99 실측 */
  p99: number;
  /** AMP 동적 임계 */
  amp: number;
  /** CloudWatch 동적 임계 */
  cw: number;
}

/**
 * 동적 임계는 최근 30분 창을 굴려 재계산되므로 몇 ms 단위로 계속 움직인다 — 그 미세한 흔들림이
 * "동적"의 근거라 그래프에 그대로 남긴다. 반대로 방송 시작 후의 급등은 30분 창에서 아직
 * 소수점이라 임계가 따라 올라가지 않는다. 이 시차가 곧 이탈 탐지다.
 */
export function buildDetectSeries(): DetectPoint[] {
  const out: DetectPoint[] = [];
  for (let t = -DETECT_LEAD_MS; t <= DETECT_SPAN_MS - DETECT_LEAD_MS; t += 500) {
    const i = t / 500;
    const wob = Math.sin(t / 4_200) * 3.4 + jitter(i + 21, 2.2);
    out.push({
      t,
      // 알람 이전은 평상시 P99(128ms대)로 눕는다 — onstyleP99 는 0초부터만 정의된다
      p99: Math.round(onstyleP99(Math.max(0, t)) + jitter(i + 5, 14) + (t < 0 ? jitter(i + 31, 7) : 0)),
      amp: Math.round(DETECT_AMP_BASE + wob),
      cw: Math.round(DETECT_CW_BASE + wob * 0.8 + Math.sin(t / 6_100) * 2.6),
    });
  }
  return out;
}

const QUOTA_STEPS: AgentStep[] = [
  /* ── Agent 1 · 트래픽 기반 동적 자원 효율화 ──
     이번 경로는 재분배가 아니라 스케일링 에스컬레이션(노드풀 격리)이다.
     파이 안에서 못 막는다는 걸 결정론으로 먼저 확정하고, 그 다음에만 LLM 이 개입한다. */
  {
    id: 'q-trigger', t: 8_000, agent: 'quota', phase: 'detect',
    state: 'trigger', executor: 'code',
    title: '트리거 — 사용률 80% 초과 지속',
    detail: '배송 완료 시각은 새벽~밤으로 불규칙해 트래픽을 미리 맞출 수 없다. 그래서 관측(추세)과 비즈니스 데이터를 함께 쓴다.',
    payload: { lines: ['cjlogistics  2,880 / 3,600 rps  =  80.0%  (2분 지속)'] },
  },
  {
    id: 'q-fetch', t: 11_000, agent: 'quota', phase: 'triage',
    state: 'fetch_signals', executor: 'code',
    title: '데이터 3종 조회',
    payload: {
      lines: [
        '① 추세      AMP(Prometheus)                최근 기울기 +72 rps/분  (평시 트리거 대비 3.1배)',
        '② 이벤트    DynamoDB cjone-business-events   추석 연휴 종료 익일 · 적체 물량 예상배수 4.3',
        '③ 과거실측  S3 장기보관 → Athena            작년 추석 직후 실측/예상 = 1.04 → 보정',
      ],
    },
  },
  {
    id: 'q-need', t: 15_000, agent: 'quota', phase: 'triage',
    state: 'compute_need', executor: 'code',
    title: '필요량 산출',
    detail: '추세와 이벤트 두 투영을 각각 구해 큰 쪽을 택한다 — 보수적으로.',
    payload: PROJECTION,
  },
  {
    id: 'q-pool', t: 19_000, agent: 'quota', phase: 'triage',
    state: 'check_pool', executor: 'code',
    title: '파이 안에서 조달 가능한가 — 불가',
    detail: '여기서 갈린다. 파이 안이면 재분배, 파이 밖이면 스케일링 에스컬레이션.',
    payload: {
      lines: [
        '필요량            2,000 rps',
        '전체 파이 여유      870 rps  (도너 3곳 합)',
        '부족               1,130 rps',
        '→ 재분배 불가 · 스케일링 에스컬레이션 분기로 넘긴다',
      ],
    },
  },
  {
    id: 'q-donors', t: 25_000, agent: 'quota', phase: 'diagnose',
    state: 'build_candidates', executor: 'code',
    title: '도너를 다 합쳐도 모자란다',
    detail: '"지금 남는 양"과 "내줄 수 있는 양"은 다르다. 도너의 미래 필요분을 먼저 뺀 값이다.',
    payload: {
      donors: [
        { name: 'CJ ONSTYLE', quota: 1200, future: 900, giveable: 300, risk: 22, note: '편성 이벤트 없음 · 변동성 낮음' },
        { name: '뚜레쥬르', quota: 900, future: 750, giveable: 150, risk: 38, note: '아침 피크 지난 시간대' },
        { name: 'VIPS', quota: 600, future: 180, giveable: 420, risk: 81, note: '저녁 예약 오픈 3시간 뒤 · 변동성 높음' },
      ],
    },
  },
  {
    id: 'q-risk', t: 30_000, agent: 'quota', phase: 'diagnose',
    state: 'assess_shape', executor: 'code',
    title: '왜 쿼터만 올려선 안 되는가 — 근거 3종',
    payload: {
      reasonTrio: {
        need: 2_000,
        pool: 870,
        slopePerMin: 72,
        timesNormal: 3.1,
        cv: 0.61,
        historyNote: '작년 추석 직후 · 같은 노드풀 공유 테넌트 동반 지연 · 장애 1건',
      },
    },
  },
  {
    id: 'q-decide', t: 34_000, agent: 'quota', phase: 'diagnose',
    state: 'select_escalation', executor: 'llm',
    model: MODEL_ID, tokens: { in: 4260, out: 540 },
    title: '에스컬레이션 방식 선택 — 이 파이프라인에서 유일한 LLM 개입',
    payload: {
      options: [
        { name: '기존 노드풀에서 HPA 상한만 상향', verdict: '기각', note: '같은 노드풀 공유 — 작년 장애가 정확히 이 경로였다' },
        { name: 'CJ 대한통운 전용 노드풀 격리 (Karpenter)', verdict: '채택', note: '옆 테넌트 영향 0 · 불규칙 스파이크를 노드 경계로 흡수 · 연휴 종료 후 회수' },
        { name: '클러스터 전체 노드 증설', verdict: '기각', note: '한 테넌트 때문에 전 테넌트 비용을 올린다 · 격리 효과도 없음' },
      ],
    },
  },
  {
    id: 'q-verify', t: 38_000, agent: 'quota', phase: 'diagnose',
    state: 'validate', executor: 'code',
    title: '검증 — 어기면 무조건 틀린 것만',
    detail: '검증에까지 AI 를 넣으면 불확실한 단계를 하나 더 쌓는 꼴이다. 여기는 규칙만 건다.',
    payload: {
      checks: [
        { n: '①', label: '신규 쿼터 ≥ 예상 RPS', ok: true, note: '5,600 ≥ 5,600' },
        { n: '②', label: '도너 쿼터 불변 — 남의 것을 뺏지 않음', ok: true, note: 'ONSTYLE 1,200 · 뚜레쥬르 900 · VIPS 600' },
        { n: '③', label: '노드풀 상한 · 계정 vCPU 쿼터 내', ok: true, note: '+12 노드 · 한도 40' },
        { n: '④', label: '회수 조건 명시', ok: true, note: '사용률 40% 미만 30분 지속 시 원복' },
        { n: '⑤', label: '동일 테넌트 진행 중 조치 없음', ok: true },
      ],
      footer: '하나라도 어기면 집행하지 않는다.',
    },
  },
  {
    id: 'q-apply', t: 44_000, agent: 'quota', phase: 'act',
    state: 'isolate_nodepool.py', executor: 'exec',
    title: '집행 — 전용 노드풀 격리',
    payload: {
      lines: [
        'Karpenter NodePool  cjlogistics-dedicated  생성 · taint/toleration 적용',
        'cjlogistics 워크로드 이동 → 공유 노드풀에서 분리',
        'cjlogistics  3,600 → 5,600 rps   (도너 쿼터 불변 · 파이 자체가 커진다)',
      ],
      nodepoolSplit: {
        tenant: 'oliveyoung',
        shared: ['cgv', 'cjenm', 'vips'],
      },
    },
  },
  {
    id: 'q-cool', t: 48_500, agent: 'quota', phase: 'cooldown',
    state: 'quota-locks · TTL', executor: 'code',
    title: '쿨다운 — 재발화 억제 · 회수 조건 감시',
    payload: {
      lines: [
        'quota-locks TTL 유지  ·  cjlogistics 재발화 차단 5분',
        '회수 조건            사용률 40% 미만 30분 지속 → 노드풀 반납',
        '다음 트리거까지 사용률 추이만 지켜본다',
      ],
    },
  },
  {
    id: 'q-cool-1', t: 50_000, agent: 'quota', phase: 'cooldown',
    state: 'usage-monitor.py', executor: 'code',
    title: '모니터링 — 사용률 재확인',
    payload: {
      counter: 1, total: 3,
      lines: [
        'CJ 대한통운 사용률   82% → 76%   (경과 6분)',
        'quota-locks TTL 남음 4분',
      ],
    },
  },
  {
    id: 'q-cool-2', t: 54_000, agent: 'quota', phase: 'cooldown',
    state: 'usage-monitor.py', executor: 'code',
    title: '모니터링 — 사용률 재확인',
    payload: {
      counter: 2, total: 3,
      lines: [
        'CJ 대한통운 사용률   76% → 69%   (경과 10분)',
        '대기 커넥션          210 → 154건',
      ],
    },
  },
  {
    id: 'q-cool-3', t: 58_000, agent: 'quota', phase: 'cooldown',
    state: 'usage-monitor.py', executor: 'code',
    title: '모니터링 — 사용률 재확인',
    payload: {
      counter: 3, total: 3,
      lines: [
        'CJ 대한통운 사용률   69% → 61%   (경과 14분)',
        '회수 조건 미충족 — 40% 미만 30분 지속 필요',
      ],
    },
  },
  {
    id: 'q-record', t: 76_000, agent: 'quota', phase: 'done',
    state: 'quota-decisions', executor: 'code',
    title: '조치 이력 저장',
    detail: '무엇을·왜·언제. 사후 배치 분석과 정확도 평가의 원천이 된다.',
    payload: {
      lines: [
        'DynamoDB quota-decisions  ·  decision = nodepool_isolation  ·  quota-locks 해제',
        'llm_fallback = false  (모델 정상 응답)',
      ],
    },
  },

];

const INCIDENT_STEPS: AgentStep[] = [
  /* ── Agent 2 · 이상 탐지 및 대응 ─────────────────────────────
     대한통운(oliveyoung)은 Agent 1 에서 전용 노드풀로 격리됐지만, 데이터 계층(Aurora · RDS Proxy)은
     여전히 공유다. 그 위에서 CJ 온스타일(cgv)이 라이브 커머스 방송을 시작하며 적립 쓰기가 몰린다. */
  {
    id: 'i-sqs', t: 8_000, agent: 'incident', phase: 'detect',
    state: 'SQS incident-alerts', executor: 'code',
    title: '알람 수신 — 3소스 합의',
    payload: {
      lines: [
        'AMP Alertmanager   cjonstyle · PointEarnLatency · 동적 베이스라인 이탈 (182ms → 2,400ms)',
        'CloudWatch Alarm   공용 RDS Proxy 커넥션 사용률 임계 초과 (97%)',
        '정적 알람          해당 없음 (OOMKill · CrashLoop)',
      ],
    },
  },
  {
    id: 'i-collect', t: 8_000, agent: 'incident', phase: 'collect',
    state: '전처리 Lambda · 데이터 수집', executor: 'code',
    title: '수집 소스 스캔',
    payload: {
      lines: [
        'ArgoCD    최근 배포 없음 (마지막 6h 전)',
        'DynamoDB  cjone-business-events   CJ 온스타일 라이브 커머스 방송 시작 10:02 KST',
        'Loki      최근 5분 ERROR 612건 · 대표 메시지 "connection pool exhausted" 외 3개',
      ],
    },
  },
  {
    /* 소스 3종(ArgoCD·DynamoDB·Loki)이 왼쪽 카드에서 전부 초록으로 바뀐 뒤(t=9.6s)에 뜬다.
       모아둔 게 있어야 등급을 매길 수 있으니 순서가 뒤집히면 안 된다 — SlotPanel 의 COLLECT_STEPS 와 같은 시각을 쓴다. */
    id: 'i-grade', t: 10_400, agent: 'incident', phase: 'collect',
    state: '전처리 Lambda · 장애 등급 산출', executor: 'code',
    title: '장애 등급 산출',
    detail: '등급은 LLM 이 아니라 규칙이 매긴다 — 같은 입력이면 항상 같은 등급이 나와야 조치 범위와 승인 등급이 흔들리지 않는다.',
    payload: {
      lines: [
        'G1 지연        에러율 < 1%  ·  P99 > SLO',
        'G2 부분 실패   에러율 1~10%',
        'G3 전면 중단   에러율 > 10%',
        '',
        '입력  적립 P99 2,400ms / SLO 1,000ms (240%)  ·  에러율 0.3%  ·  영향 3/4 테넌트',
        '판정  G1 지연 — 느려진 것이지 끊긴 것은 아니다 (에러율 정상)',
        '후속  G1 → 조치 조합 상한 5개  ·  위험도 T2 이상이면 사람 승인',
      ],
    },
  },
  {
    id: 'i-prompt', t: 12_400, agent: 'incident', phase: 'collect',
    state: '전처리 Lambda · 프롬프트 제작', executor: 'code',
    title: '프롬프트 제작',
    detail: '자유 서술이 아니라 고정 슬롯 4개를 채운 정형 템플릿이다 — 같은 상황이면 같은 프롬프트가 나와야 진단 결과를 서로 비교할 수 있다.',
    payload: {
      lines: [
        '[정규화 트리거]  AMP · CloudWatch · 정적 알람 3소스 → 단일 형식  ·  중복 체크 결과 신규 건',
        '[수집 데이터]    ArgoCD 배포 없음  ·  방송 시작 10:02 KST  ·  Loki ERROR 612건',
        '[장애 등급]      G1 지연  ·  P99 SLO 240%  ·  에러율 정상',
        '[출력 스키마]    root_cause[] · evidence[] · confidence · runbook_ids[]',
        '',
        '완성 프롬프트 → 다음 단계 진단 모델 호출의 입력이 된다',
      ],
    },
  },
  {
    id: 'i-tool-metric', t: 14_500, agent: 'incident', phase: 'diagnose',
    state: '진단 에이전트 (Bedrock) · 도구 호출', executor: 'llm',
    model: MODEL_ID, tokens: { in: 13_200, out: 990 },
    title: '사용한 도구',
    detail: '정해진 원인 목록 없이 자유 도출한다. 메트릭 · 로그 · 커넥션 풀 상태를 동시에 확인한다.',
    payload: {
      groups: [
        {
          heading: '메트릭',
          lines: [
            'AMP         cjonstyle(온스타일) 적립 RPS 360 → 940  (+161%)',
            'CloudWatch  공용 RDS Proxy 커넥션 풀 사용률 60% → 97%',
            'HPA         레플리카 6 → 10 (설정 상한까지 이미 자동 확장 — 더 늘리려면 상한 자체를 올려야 한다)',
          ],
        },
        {
          heading: '로그',
          lines: [
            'Loki   슬로우 쿼리 로그 340건 · 평균 실행 22초',
            'Loki   대표 쿼리 "point_ledger 적립 집계 GROUP BY member_id"',
            'Loki   "connection pool exhausted" 128건',
          ],
        },
        {
          heading: '커넥션 풀',
          lines: [
            'RDS Proxy   max_connections 400 · 사용 388 · 대기 340',
            '대기 시간   평균 4.8초 · 최대 12.1초',
          ],
        },
      ],
    },
  },
  {
    id: 'i-json', t: 20_500, agent: 'incident', phase: 'diagnose',
    state: '출력 JSON (스키마 고정)', executor: 'llm',
    title: '원인 도출 : CJ ONSTYLE 라이브 커머스로 적립 요청 공용 풀 소진',
    payload: {
      tenant: 'cgv',
      occurred_at: '10:09:04',
      symptom: '포인트 적립 P99 2.4s · SLO(1.0s) 대비 240%',
      direct_cause: '공용 RDS Proxy 커넥션 풀 97% 점유 · 대기 커넥션 340건',
      root_cause: '적립 집계 쿼리가 평균 22초간 커넥션 점유 상태, 라이브로 쓰기 요청이 급증해 대기 큐 증가 및 처리량 부족',
    },
  },
  {
    id: 'i-verify', t: 27_500, agent: 'incident', phase: 'diagnose',
    state: '검증 Lambda (결정론)', executor: 'code',
    title: '검증(결정론)',
    detail: '평가받을 대상에게 몇 점 같냐고 묻지 않는다. 신뢰도는 도구 호출 기록이라는 사실로 계산한다.',
    payload: {
      checks: [
        { n: '①', label: 'JSON 스키마 검사', ok: true },
        { n: '②', label: '신뢰도 = 호출수/4 ×0.4 + 종류/3 ×0.3 + evidence 근거율 ×0.3', ok: true, note: '3/4×0.4 + 3/3×0.3 + 0.6×0.3 = 0.78' },
        { n: '③', label: '신뢰도 ≥ 0.5', ok: true, note: '0.78 ≥ 0.5 → 통과' },
      ],
      footer: 'LLM 자가 confidence 는 쓰지 않는다. 신뢰 불가면 재진단 1회(도구 추가 조회 지시), 2회 실패면 사람에게 보고하고 중단한다.',
    },
  },
  {
    id: 'i-plan', t: 34_500, agent: 'incident', phase: 'act',
    state: '조치 에이전트 (Bedrock)', executor: 'llm',
    model: MODEL_ID, tokens: { in: 7_200, out: 820 },
    title: '원인(처리 병목) 해결 방법',
    detail: '스로틀(RB-03)은 수요 자체를 깎는다. 원인이 수요가 아니라 처리 쪽 병목이라 배제하고, 풀을 넓히고 여유를 늘리는 조합을 택했다.',
    payload: {
      expected: 'P99 1.0s 이내 · 공용 풀 사용률 65% 이하',
      milestones: ['4분 내 대기 커넥션 50건 이하', '7분 내 P99 SLO 이내 회복'],
      // HitlPopup 이 이 필드들을 그대로 읽어 쓴다 — 로그(오른쪽)에서는 ①②만 보여주고 이 둘은 렌더링하지 않을 뿐, 데이터는 지우면 안 된다
      plan: [
        { id: 'RB-04', name: 'RDS Proxy 커넥션 풀 조정', param: 'max_connections 400 → 640' },
        { id: 'RB-05', name: '슬로우 쿼리 세션 종료', param: '실행 20초 초과 세션' },
        { id: 'RB-01', name: 'HPA 레플리카 상향', param: '레플리카 6 → 12' },
      ],
      monitorSec: 600,
    },
  },
  {
    id: 'i-catalog', t: 41_000, agent: 'incident', phase: 'act',
    state: '카탈로그 조합으로 답이 나오나', executor: 'code',
    title: '기존 런북 카탈로그에서 매칭',
    detail: '런북이 리소스 두 개를 만지면 권한도 둘 다 열린다. 최소 권한을 지키려면 쪼개고, 필요한 만큼만 조합한다 — 상한은 5개지만 이번엔 3개로 충분하다.',
    payload: {
      catalog: [
        { ids: ['RB-01'], name: 'HPA 레플리카 상향', tag: 'k8s', chosen: true },
        { ids: ['RB-02'], name: '파드 롤링 재시작', tag: 'k8s' },
        { ids: ['RB-03'], name: '테넌트 RPS 스로틀', tag: 'ratelimit' },
        { ids: ['RB-04'], name: 'RDS Proxy 커넥션 풀', tag: 'rds', chosen: true },
        { ids: ['RB-05'], name: '슬로우 쿼리 종료', tag: '집행경로 없음', chosen: true },
        { ids: ['RB-06', 'RB-07'], name: '노드풀 격리 · 노드 cordon' },
        { ids: ['RB-08', 'RB-09'], name: 'ArgoCD 롤백 · limit 상향' },
        { ids: ['RB-10'], name: 'RLS Redis 재시작', tag: 'k8s' },
        { ids: ['RB-11', 'RB-12'], name: '테넌트 통보 · 쿼터 핸드오프' },
        { ids: ['RB-13'], name: '무조치 · 에스컬레이션', tag: 'notify' },
      ],
      catalogCap: 5,
      note: '미매칭이었다면 런북 직접 제작 → 무조건 T3 (HITL + 보고서). 승인·실행되면 카탈로그에 적립해 다음엔 조합 경로로 처리한다.',
    },
  },
  {
    id: 'i-tier', t: 50_500, agent: 'incident', phase: 'act',
    state: '티어 판정 (AI)', executor: 'llm',
    model: MODEL_ID, tokens: { in: 2_200, out: 170 },
    title: 'T2 — HITL',
    detail: '장애 등급 × 런북 조합 위험도 × 출처(기존 / 직접 제작)',
    payload: {
      options: [
        { name: 'T1 — 완전 자동 실행 (승인 없음)', verdict: '기각', note: '런북 조합 위험도가 높아 무인 실행은 배제' },
        { name: 'T2 — Slack 승인 후 실행 (타임아웃 600초)', verdict: '채택', note: '장애 등급 높음 + 기존 카탈로그 런북 → 승인만 거치면 충분' },
        { name: 'T3 — 사람이 직접 제작 · 보고서 동반', verdict: '기각', note: '기존 런북 매칭 성공 · 직접 제작 불필요' },
      ],
    },
  },
  {
    id: 'i-hitl', t: 53_000, agent: 'incident', phase: 'act',
    state: 'HITL — Slack 승인', executor: 'code',
    title: 'HITL — Slack 승인 대기',
    detail: '완전 자동화가 목표가 아니다. 승인 버튼을 누를 수 있는 상태까지 자동으로 만드는 게 범위다.',
    payload: {
      lines: [
        '@yuhyun 승인 · 55초',
        '타임아웃이었다면 실행하지 않는다 — 이력만 기록하고 사람에게 통보',
      ],
    },
  },
  {
    id: 'i-exec', t: 58_000, agent: 'incident', phase: 'act',
    state: '런북 executor Lambda', executor: 'exec',
    title: 'EKS · Aurora 집행',
    detail: '서비스 최소 가용 구간은 AI 불가침. Kyverno 정책이 executor 보다 먼저 막는다.',
    payload: {
      lines: [
        '권한 분리       IAM · K8s RBAC (런북별 최소 권한)',
        'Kyverno 사전 가드레일   통과',
        '집행 ① RB-04   RDS Proxy 커넥션 풀 max_connections 400 → 640',
        '집행 ② RB-05   슬로우 쿼리 세션(실행 20초 초과) 강제 종료',
        '집행 ③ RB-01   HPA 레플리카 6 → 12',
      ],
    },
  },
  {
    id: 'i-watch', t: 65_000, agent: 'incident', phase: 'cooldown',
    state: '모니터링 Lambda · 600초', executor: 'code',
    title: '마일스톤 순서대로 확인',
    payload: {
      checks: [
        { n: 'M1', label: '4분 내 대기 커넥션 50건 이하', ok: true, note: '+210s · 38건' },
        { n: 'M2', label: '7분 내 P99 SLO(1.0s) 이내', ok: true, note: '+260s · 620ms' },
        { n: '결과', label: '예상 결과 도달 — P99 1.0s 이내 · 풀 62% 이하', ok: true },
      ],
      poolChart: { series: [97, 92, 87, 81, 76, 71, 67, 63, 61, 59, 58], target: 90, goal: 62 },
      footer: '미도달이면 진단으로 되돌려 재진단 1회. 2회째면 사람에게 에스컬레이션한다.',
    },
  },
  {
    id: 'i-record', t: 77_000, agent: 'incident', phase: 'done',
    state: '종료 · DynamoDB 이력 기록', executor: 'code',
    title: '장애 · 조치 이력 저장 · Slack 보고',
    payload: { lines: ['DynamoDB 장애·조치 이력 기록', 'Slack 보고 — T1 자동 실행 건도 사후 보고 대상'] },
  },
];

const CAVEATS_Q = [
  '에이전트 이벤트는 전부 목업 — 실제 Step Functions 실행 이력 연결 전',
  'SLO 임계값(300ms)은 SLI/SLO 설계 문서 확정치 반영 전',
];
const CAVEATS_I = [
  '에이전트 이벤트는 전부 목업 — 실제 Step Functions 실행 이력 연결 전',
  'SLO 임계값(1,000ms)은 SLI/SLO 설계 문서 확정치 반영 전',
];

/** Agent 1 — 추석 연휴 직후 물량 폭주 → 노드풀 격리 */
export function buildQuotaRun(): RunTimeline {
  return {
    runId: 'sfn-q-2609-0417',
    durationMs: DURATION_Q,
    sloMs: SLO_MS,
    tenantTotal: 56,
    projection: PROJECTION,
    steps: [...QUOTA_STEPS].sort((a, b) => a.t - b.t),
    samples: buildSamples(DURATION_Q, quotaRunQps, quotaRunP99, (t) => (t < REBALANCE_AT ? QUOTA : QUOTA_AFTER)),
    caveats: CAVEATS_Q,
  };
}

/** Agent 2 — 별개 상황. Agent 1 과 시계도 데이터도 공유하지 않는다. */
export function buildIncidentRun(): RunTimeline {
  return {
    runId: 'sfn-i-2609-0912',
    durationMs: DURATION_I,
    sloMs: SLO_MS_INCIDENT,
    tenantTotal: 56,
    projection: INCIDENT_PROJECTION,
    steps: [...INCIDENT_STEPS].sort((a, b) => a.t - b.t),
    samples: buildIncidentSamples(DURATION_I),
    caveats: CAVEATS_I,
  };
}

export async function loadRuns(): Promise<{ quota: RunTimeline; incident: RunTimeline }> {
  const source = import.meta.env.VITE_AGENT_SOURCE ?? 'mock';
  const url = import.meta.env.VITE_AGENT_EVENTS_URL as string | undefined;
  if (source === 'live' && url) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as { quota: RunTimeline; incident: RunTimeline };
    } catch { /* 아래 목업으로 떨어진다 */ }
    console.warn('[cjone] live 에이전트 이벤트를 못 읽어서 mock 으로 떨어짐');
  }
  return { quota: buildQuotaRun(), incident: buildIncidentRun() };
}
