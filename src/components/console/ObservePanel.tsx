import { useLayoutEffect, useRef, useState } from 'react';
import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import Slot from './SlotPanel';
import type { AgentId, Phase, Projection, TenantSample } from '../../lib/types';

export interface Usage { inTok: number; outTok: number; calls: number; costUsd: number }

/** 토큰 스트립 + 쿼터 사용률이 차지하는 고정 높이. 오른쪽 헤더가 여기에 맞춰 끝난다 */
export const FIXED_H = 200;

interface Props {
  samples: TenantSample[];
  idx: number;
  sloMs: number;
  tenantTotal: number;
  usage: Usage;
  agent: AgentId;
  phase: Phase;
  t: number;
  durationMs: number;
  projection: Projection;
  rebalanceNote?: string;
}

export default function ObservePanel({
  samples, idx, sloMs, tenantTotal, usage, agent, phase, t, durationMs, projection, rebalanceNote,
}: Props) {
  const sample = samples[idx] ?? samples[0];
  // Agent 1 쿨다운 — 아래 슬롯을 따로 쓰지 않으니, 쿼터 사용률 카드가 왼쪽 칸 전체로 확대되어
  // 자리를 옮겨 채운다 (PPT 전환처럼). 오른쪽은 그 시간 동안 모니터링 로그가 계속 올라온다.
  const cooldownFull = agent === 'quota' && phase === 'cooldown';

  return (
    <div style={{ flex: '5 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, overflow: 'hidden' }}>

      {/* ── 항상 떠 있는 두 칸 ─────────────────────── */}
      <div
        style={
          cooldownFull
            ? { flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 7 }
            : { height: FIXED_H, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }
        }
      >
        <div className="card" style={{ flexShrink: 0, padding: '7px 15.7px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>토큰</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {usage.inTok.toLocaleString('ko-KR')}<span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> in</span>
          </span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {usage.outTok.toLocaleString('ko-KR')}<span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> out</span>
          </span>
          <span style={{ width: 1, height: 20, background: 'var(--hair)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>호출</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{usage.calls}</span>
          <span style={{ flexGrow: 1 }} />
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>이번 run</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#9085e9' }}>${usage.costUsd.toFixed(3)}</span>
        </div>

        {agent === 'quota' ? (
          <QuotaUsageCard sample={sample} tenantTotal={tenantTotal} rebalanceNote={rebalanceNote} big={cooldownFull} />
        ) : (
          <IncidentKeyMetrics sample={sample} sloMs={sloMs} />
        )}
      </div>

      {/* ── 단계 따라 바뀌는 칸 — 쿨다운 확대 중엔 위 카드가 이 자리까지 채우므로 안 그린다 ── */}
      {!cooldownFull && (
        <Slot
          agent={agent} phase={phase} t={t} sample={sample} samples={samples} idx={idx}
          sloMs={sloMs} projection={projection} usage={usage} durationMs={durationMs}
        />
      )}
    </div>
  );
}

/** 쿼터 사용률 — 평소엔 작게, Agent 1 쿨다운에서는 big=true 로 왼쪽 칸 전체를 채운다 */
function QuotaUsageCard({
  sample, tenantTotal, rebalanceNote, big,
}: { sample: TenantSample; tenantTotal: number; rebalanceNote?: string; big?: boolean }) {
  return (
    <div
      className={
        Math.min(100, (sample.qps.oliveyoung / sample.quotaLimit.oliveyoung) * 100) >= 80
          ? 'card card-alert'
          : 'card'
      }
      style={{ flexGrow: 1, minHeight: 0, padding: big ? '16px 22px' : '9px 15.7px', display: 'flex', flexDirection: 'column', gap: big ? 12 : 4 }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexShrink: 0 }}>
        <span style={{ fontSize: big ? 19 : 15.7, fontWeight: big ? 700 : 600, flexShrink: 0 }}>쿼터 사용률</span>
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: big ? 13 : 12, color: 'var(--ink-3)', flexShrink: 0 }}>4 / {tenantTotal} 테넌트 · 대표 유형</span>
      </div>
      <div
        style={
          big
            ? { flexShrink: 0 }
            : { marginLeft: 119, marginRight: 116, height: 22, marginTop: -22, marginBottom: 10, flexShrink: 0 }
        }
      >
        {rebalanceNote && <RebalanceBadge text={rebalanceNote} />}
      </div>
      <div
        style={{
          display: 'flex', flexDirection: 'column', gap: big ? 0 : 4,
          ...(big ? { flexGrow: 1, minHeight: 0, justifyContent: 'space-evenly' } : {}),
        }}
      >
        {TENANT_ORDER.map((k) => {
          const pct = Math.min(100, (sample.qps[k] / sample.quotaLimit[k]) * 100);
          const hot = pct >= 80;
          const bold = big && k === 'oliveyoung';
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: big ? 13 : 8 }}>
              <span style={{ width: big ? 16 : 11, height: big ? 16 : 11, borderRadius: big ? 4 : 3, background: TENANTS[k].color, flexShrink: 0 }} />
              <span
                style={{
                  width: big ? 128 : 92, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontSize: bold ? 21 : big ? 17 : 13.8,
                  color: hot ? '#d03b3b' : 'var(--ink)',
                  fontWeight: bold ? 800 : hot ? 700 : big ? 500 : 400,
                }}
              >
                {TENANTS[k].label}
              </span>
              <div className="bar-track" style={{ flexGrow: 1, height: big ? 26 : 14, position: 'relative' }}>
                <div className="bar-fill" style={{ width: `${pct}%`, background: TENANTS[k].color, transition: big ? 'width .3s linear' : undefined }} />
                <span
                  style={{
                    position: 'absolute', left: '80%',
                    top: hot ? (big ? -6 : -4) : (big ? -5 : -3),
                    width: hot ? 2.5 : 1.5,
                    height: hot ? (big ? 36 : 24) : (big ? 34 : 22),
                    background: hot ? '#d03b3b' : 'var(--rule)',
                  }}
                />
              </div>
              <span
                className="mono"
                style={{
                  width: big ? 168 : 108, textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0,
                  fontSize: bold ? 21 : big ? 17 : 13.8,
                  color: hot ? '#d03b3b' : 'var(--ink-2)',
                  fontWeight: bold ? 800 : hot ? 700 : big ? 500 : 400,
                }}
              >
                {sample.qps[k].toLocaleString('ko-KR')}/{sample.quotaLimit[k].toLocaleString('ko-KR')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Agent 2 는 쿼터 사용률 대신, 모든 단계에서 계속 봐야 하는 3개 지표를 상단에 고정한다 */
function IncidentKeyMetrics({ sample, sloMs }: { sample: TenantSample; sloMs: number }) {
  const p99 = sample.p99.cgv;
  const pool = sample.leading.connPoolPct;
  const queue = sample.leading.threadQueue;
  const stats: { label: string; value: string; sub: string; warn: boolean }[] = [
    { label: '적립 P99 · CJ 온스타일', value: `${p99.toLocaleString('ko-KR')}ms`, sub: `SLO ${sloMs.toLocaleString('ko-KR')}ms`, warn: p99 > sloMs },
    { label: 'RDS Proxy 풀 사용률', value: `${pool}%`, sub: '공유 커넥션 풀', warn: pool >= 90 },
    { label: '대기 커넥션', value: `${queue.toLocaleString('ko-KR')}건`, sub: '풀 대기 큐', warn: queue >= 200 },
  ];
  return (
    <div className="card" style={{ flexGrow: 1, minHeight: 0, padding: '9px 15.7px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
        <span style={{ fontSize: 15.7, fontWeight: 600, flexShrink: 0 }}>핵심 지표</span>
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0 }}>모든 단계 공통 고정</span>
      </div>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 22 }}>
        {stats.map((st) => (
          <div key={st.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 12.2, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{st.label}</span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: st.warn ? '#d03b3b' : 'var(--ink)' }}>{st.value}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{st.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 한 줄 · 줄바꿈 없음 · 상자(80% 기준선)에 딱 맞게 글자를 키운다 */
function RebalanceBadge({ text }: { text: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [k, setK] = useState(0);

  useLayoutEffect(() => {
    const fit = () => {
      const bw = (box.current?.clientWidth ?? 0) - 14;
      const iw = inner.current?.scrollWidth ?? 0;
      if (bw > 0 && iw > 0) setK(Math.min(1, bw / iw));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span
      ref={box}
      style={{
        display: 'flex', width: '80%', height: '100%', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(208,59,59,.12)', border: '1.5px solid #d03b3b',
        borderRadius: 7, padding: '0 7px', color: '#d03b3b', overflow: 'hidden',
      }}
    >
      <span ref={inner} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', transform: `scale(${k || 0.001})`, transformOrigin: 'center' }}>
        <svg width="17" height="17" style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="#d03b3b" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" />
        </svg>
        {text}
      </span>
    </span>
  );
}
