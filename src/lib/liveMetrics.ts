import { useEffect, useRef, useState } from 'react';
import type { TenantKey, TenantSample } from './types';
import type { Usage } from '../components/console/ObservePanel';
import { TENANT_ORDER } from './tenants';

// metrics-gateway Lambda (Infra 리포, C:\Infra\lambda\metrics-gateway) 앞단 API Gateway.
// 인증 없음 — 내부 운영용 읽기 전용 집계 데이터라 지금은 열어둠.
const METRICS_API_URL =
  import.meta.env.VITE_METRICS_API_URL ||
  'https://jg5o56uyoj.execute-api.ap-northeast-2.amazonaws.com/metrics';

const POLL_MS = 10_000;
const MAX_SAMPLES = 60; // 10초 주기 * 60 = 최근 10분

// Lambda 응답 계약 축약판 — 실제 정의는 Infra 리포의
// lambda/metrics-gateway/src/types.ts (MetricsSnapshot). 별개 리포라 타입을
// 직접 import는 못 하고, 우리가 실제로 쓰는 필드만 옮겨 적는다.
interface LiveSeries {
  current: number;
}
interface LiveTenantRed {
  tenant: string;
  rate: LiveSeries;
  p99Duration: LiveSeries;
}
interface LiveBedrockModel {
  invocations: LiveSeries;
  inputTokens: LiveSeries;
  outputTokens: LiveSeries;
}
interface LiveTenantQuota {
  tenant: string;
  limitRps: LiveSeries;
}
interface LiveSnapshot {
  red: LiveTenantRed[];
  bedrock: LiveBedrockModel[];
  quota: LiveTenantQuota[];
}

// mockRun.ts의 RATE_PER_M과 동일 단가 — 리플레이/라이브 두 모드의 비용 계산 기준을 맞춘다.
const RATE_PER_M = { in: 3, out: 15 };

async function fetchSnapshot(): Promise<LiveSnapshot> {
  const res = await fetch(METRICS_API_URL);
  if (!res.ok) throw new Error(`metrics-gateway ${res.status}`);
  return (await res.json()) as LiveSnapshot;
}

function emptyRecord(): Record<TenantKey, number> {
  return Object.fromEntries(TENANT_ORDER.map((k) => [k, 0])) as Record<TenantKey, number>;
}

function toSample(snap: LiveSnapshot): TenantSample {
  const qps = emptyRecord();
  const p99 = emptyRecord();
  for (const t of snap.red) {
    if (!TENANT_ORDER.includes(t.tenant as TenantKey)) continue; // "anon" 등 제외
    const k = t.tenant as TenantKey;
    qps[k] = t.rate.current;
    p99[k] = t.p99Duration.current * 1000; // 초 -> ms (ObservePanel/mockRun 관례)
  }
  // 2026-08-27 metrics-gateway에 추가된 실리움/Envoy ratelimit 기반 실제 한도값
  // (quota-exporter의 cjone_tenant_quota_rps) — [[metrics-gateway-lambda]] 참고.
  const quotaLimit = emptyRecord();
  for (const q of snap.quota) {
    if (!TENANT_ORDER.includes(q.tenant as TenantKey)) continue;
    quotaLimit[q.tenant as TenantKey] = q.limitRps.current;
  }
  return {
    t: Date.now(),
    qps,
    p99,
    quotaLimit,
    // leading은 아직 라이브로 못 붙임 — DB커넥션풀은 metrics-gateway에 있지만
    // (db.connPoolPct 등, 테넌트별이 아니라 전역값이라 이 자리 모양과 안 맞음)
    // HPA는 아직 데이터 자체가 없음. [[metrics-gateway-lambda]] "다음 세션" 참고.
    leading: { connPoolPct: 0, threadQueue: 0, connWaitSlope: 0, hpaReplicas: 0 },
  };
}

function toUsage(snap: LiveSnapshot): Usage {
  let inTok = 0;
  let outTok = 0;
  let calls = 0;
  for (const m of snap.bedrock) {
    inTok += m.inputTokens.current;
    outTok += m.outputTokens.current;
    calls += m.invocations.current;
  }
  const costUsd = (inTok / 1e6) * RATE_PER_M.in + (outTok / 1e6) * RATE_PER_M.out;
  return { inTok, outTok, calls, costUsd };
}

export function useLiveMetrics() {
  const [samples, setSamples] = useState<TenantSample[]>([]);
  const [usage, setUsage] = useState<Usage>({ inTok: 0, outTok: 0, calls: 0, costUsd: 0 });
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const snap = await fetchSnapshot();
        if (!alive) return;
        setSamples((prev) => [...prev, toSample(snap)].slice(-MAX_SAMPLES));
        setUsage(toUsage(snap));
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '조회 실패');
      }
    };
    void tick();
    timer.current = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return { samples, usage, error };
}
