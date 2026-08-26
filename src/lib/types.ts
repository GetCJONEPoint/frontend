export type TenantKey = 'cgv' | 'cjenm' | 'oliveyoung' | 'vips';

export type ApiOp = 'earn' | 'use' | 'balance';

/** POS 창에서 실제로 한 번 호출한 결과. 이게 콘솔로 그대로 방송된다. */
export interface PosCall {
  traceId: string;
  tenant: TenantKey;
  op: ApiOp;
  method: 'GET' | 'POST';
  path: string;
  status: number;
  ok: boolean;
  ms: number;
  at: number;
  error?: string;
  /** 401/403 — 키 설정을 열라고 안내할 신호 */
  needsKey?: boolean;
  /** 목업 응답이면 true — 화면에 반드시 표시한다 */
  mocked?: boolean;
  balanceAfter?: number;
}

export interface Balance {
  memberId: string;
  balance: number;
  expiringSoon?: number;
  expiringAt?: string;
}

/* ─── 에이전트 실행 모델 ───────────────────────────────
   Agent 1 = 쿼터 재분배 (예방적 · 트리거 = 쿼터 80%)
   Agent 2 = 장애 대응   (사후적 · 트리거 = 이상탐지 알람)
   executor 는 "누가 판단했나" — 발표의 핵심 논거라 모든 단계에 붙인다. */

export type AgentId = 'quota' | 'incident';
export type Executor = 'llm' | 'code' | 'exec';
export type Phase = 'detect' | 'triage' | 'preprocess' | 'collect' | 'diagnose' | 'act' | 'cooldown' | 'done';

export interface AgentStep {
  id: string;
  /** run 시작 시점 기준 오프셋(ms) */
  t: number;
  agent: AgentId;
  phase: Phase;
  /** 실제 상태/함수 이름 — 지어낸 단계명 대신 구현에 있는 이름을 쓴다 */
  state: string;
  executor: Executor;
  title: string;
  detail?: string;
  payload?: unknown;
  /** LLM 단계에만 — 실시간 토큰 사용량 집계용 */
  tokens?: { in: number; out: number };
  /** LLM 단계에만 — 호출한 모델 */
  model?: string;
}

/** 필요량 산출 — 전부 결정론. LLM 은 여기 안 들어온다. */
export interface Projection {
  tenant: TenantKey;
  currentRps: number;
  quota: number;
  horizonMin: number;
  slopePerMin: number;
  /** 추세 투영 = 현재 + 기울기 × 지평 */
  trendRps: number;
  /** 이벤트 투영 = baseline × 예상배수 × (과거 실측 / 예상) */
  eventRps: number;
  /** 둘 중 큰 쪽 — 보수적으로 */
  expectedRps: number;
  /** max(0, 예상 − 현재 쿼터) */
  needRps: number;
  /** 도너들이 줄 수 있는 양의 합 */
  poolFreeRps: number;
}

export interface TenantSample {
  t: number;
  qps: Record<TenantKey, number>;
  p99: Record<TenantKey, number>;
  quotaLimit: Record<TenantKey, number>;
  leading: {
    connPoolPct: number;
    threadQueue: number;
    connWaitSlope: number;
    hpaReplicas: number;
  };
}

export interface RunTimeline {
  runId: string;
  durationMs: number;
  sloMs: number;
  /** 실서비스 대상 테넌트 수 (발표는 대표 4개만) */
  tenantTotal: number;
  projection: Projection;
  steps: AgentStep[];
  samples: TenantSample[];
  /** 화면에 미리 밝히는 미구현 항목 */
  caveats: string[];
}
