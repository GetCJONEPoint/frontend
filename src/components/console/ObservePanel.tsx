import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import type { PosCall, TenantSample } from '../../lib/types';

export interface Usage {
  inTok: number;
  outTok: number;
  calls: number;
  costUsd: number;
}

/* 이 컬럼은 두 에이전트가 공유하는 상황판이라 다른 곳보다 크게 잡는다 (약 130%) */
const PLOT_W = 560;
const PLOT_H = 300;  // viewBox 단위. 실제 높이는 남는 공간이 정한다
const Y_MAX = 2400;   // 적립 P99 가 2 초대까지 솟는다
const TICKS = [1000, 2000];

interface Props {
  samples: TenantSample[];
  idx: number;
  sloMs: number;
  posCalls: PosCall[];
  tenantTotal: number;
  usage: Usage;
  /** 조합 선택이 끝난 뒤에만 뜬다 */
  rebalanceNote?: string;
  /** 쿼터를 내준 테넌트 — 자리는 그대로 두고 색만 바꾼다 */
  donors?: string[];
}

export default function ObservePanel({ samples, idx, sloMs, posCalls, tenantTotal, usage, rebalanceNote, donors = [] }: Props) {
  const sample = samples[idx] ?? samples[0];
  const shown = samples.slice(0, idx + 1);
  const xOf = (i: number) => (i / (samples.length - 1)) * PLOT_W;
  const yOf = (v: number) => PLOT_H - (Math.min(v, Y_MAX) / Y_MAX) * PLOT_H;

  return (
    <div style={{ flex: '5 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0, overflow: 'hidden' }}>

      {/* 리소스 — 에이전트가 실제로 쓰는 비용. 상주 인프라 대비 우위가 설계 논거다 */}
      <div className="card" style={{ flexShrink: 0, padding: '7px 15.7px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>토큰</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {usage.inTok.toLocaleString('ko-KR')}
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> in</span>
        </span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
          {usage.outTok.toLocaleString('ko-KR')}
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}> out</span>
        </span>
        <span style={{ width: 1, height: 20, background: 'var(--hair)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>호출</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{usage.calls}</span>
        <span style={{ flexGrow: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>이번 run</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: '#9085e9' }}>
          ${usage.costUsd.toFixed(3)}
        </span>
      </div>

      {/* p99 시계열 — 이 카드만 남는 세로를 흡수한다. 창 높이가 달라져도 다른 칸이 안 깨진다 */}
      <div className="card" style={{ flexGrow: 1, flexShrink: 1, minHeight: 160, padding: '11px 15.7px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>테넌트별 p99</span>
          <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>SLO {sloMs}ms</span>
          <span style={{ flexGrow: 1 }} />
          {TENANT_ORDER.map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4.6 }}>
              <span style={{ width: 11, height: 3, borderRadius: 2, background: TENANTS[k].color }} />
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{TENANTS[k].label}</span>
            </span>
          ))}
        </div>

        {/* 한 사건이 두 축으로 번지는 게 이 시연의 뼈대다 */}
        <div style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0, marginTop: -3, lineHeight: 1.4 }}>
          추석 연휴 직후 · <span style={{ color: 'var(--t-oliveyoung)', fontWeight: 600 }}>CJ 대한통운</span> 적체 물량 일괄 배송완료
          {'  →  '}쿼터 축 Agent 1{'  ·  '}적립 지연 축 Agent 2
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, position: 'relative', paddingRight: 30 }}>
          <svg
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
            role="img"
            aria-label="테넌트별 p99 시계열"
          >
            <line x1="0" y1={PLOT_H} x2={PLOT_W} y2={PLOT_H} stroke="var(--rule)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
            <line
              x1="0" y1={yOf(sloMs)} x2={PLOT_W} y2={yOf(sloMs)}
              stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke"
            />
            {TICKS.map((v) => (
              <line
                key={v} x1="0" y1={yOf(v)} x2={PLOT_W} y2={yOf(v)}
                stroke="var(--hair)" strokeWidth="1" vectorEffect="non-scaling-stroke"
              />
            ))}
            {TENANT_ORDER.map((k) => (
              <polyline
                key={k}
                fill="none"
                stroke={TENANTS[k].color}
                strokeWidth={k === 'cgv' ? 2.6 : 1.9}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={shown.map((s, i) => `${xOf(i).toFixed(1)},${yOf(s.p99[k]).toFixed(1)}`).join(' ')}
              />
            ))}
          </svg>
          <span
            style={{
              position: 'absolute', right: 0, top: `${(1 - Math.min(sloMs, Y_MAX) / Y_MAX) * 100}%`,
              transform: 'translateY(-50%)', fontSize: 12, color: 'var(--warn)', whiteSpace: 'nowrap',
            }}
          >
            SLO
          </span>
          {TICKS.map((v) => (
            <span
              key={v}
              style={{
                position: 'absolute', right: 0, top: `${(1 - v / Y_MAX) * 100}%`,
                transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap',
              }}
            >
              {v / 1000}s
            </span>
          ))}
        </div>
      </div>

      {/* 테넌트 쿼터 사용률 */}
      <div className="card" style={{ flexShrink: 0, padding: '8px 15.7px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600, flexShrink: 0 }}>쿼터 사용률</span>
          <span style={{ flexGrow: 1 }} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>4 / {tenantTotal} 테넌트 · 대표 유형</span>
        </div>
        <div style={{ marginLeft: 133.4, height: 19, flexShrink: 0 }}>
          {rebalanceNote && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(208,59,59,.12)', border: '1px solid #d03b3b',
                borderRadius: 7, padding: '2.5px 9px', color: '#d03b3b',
                fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d03b3b" strokeWidth="2.8" strokeLinecap="round">
                <path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" />
              </svg>
              {rebalanceNote}
            </span>
          )}
        </div>
        {TENANT_ORDER.map((k) => {
          const pct = Math.min(100, (sample.qps[k] / sample.quotaLimit[k]) * 100);
          const hot = pct >= 80;
          const donor = donors.includes(k);
          const dc = donor ? TENANTS[k].color : null;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9.2 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: dc ?? TENANTS[k].color, flexShrink: 0 }} />
              <span style={{ width: 104, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 13.8, color: dc ?? (hot ? '#d03b3b' : 'var(--ink)'), fontWeight: hot || donor ? 700 : 400 }}>{TENANTS[k].label}</span>
              <div className="bar-track" style={{ flexGrow: 1, height: 14, position: 'relative' }}>
                <div className="bar-fill" style={{ width: `${pct}%`, background: dc ?? TENANTS[k].color }} />
                <span style={{ position: 'absolute', left: '80%', top: hot ? -4 : -3, width: hot ? 2.5 : 1.5, height: hot ? 24 : 22, background: hot ? '#d03b3b' : 'var(--rule)' }} />
              </div>
              <span className="mono" style={{ width: 120, textAlign: 'right', fontSize: 13.8, color: dc ?? (hot ? '#d03b3b' : 'var(--ink-2)'), fontWeight: hot || donor ? 700 : 400 }}>
                {sample.qps[k].toLocaleString('ko-KR')}/{sample.quotaLimit[k].toLocaleString('ko-KR')}
              </span>
            </div>
          );
        })}
      </div>

      {/* 실제 POS 호출 */}
      <div className="card" style={{ flexShrink: 0, padding: '12px 15.7px', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 76, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>실제 POS 호출</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>다른 창에서 누른 요청</span>
        </div>
        {posCalls.length === 0 ? (
          <span style={{ fontSize: 13.8, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            POS 창에서 버튼을 누르면 trace id 와 함께 여기 찍힙니다.
          </span>
        ) : (
          posCalls.slice(0, 2).map((c) => (
            <div key={c.traceId} className="mono" style={{ display: 'flex', gap: 9.2, fontSize: 12.9 }}>
              <span style={{ color: c.ok ? 'var(--good)' : 'var(--crit)', fontWeight: 600, width: 36 }}>{c.status || 'ERR'}</span>
              <span style={{ color: 'var(--ink-2)', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.traceId}</span>
              <span style={{ color: c.ms > 300 ? 'var(--crit)' : 'var(--ink-2)' }}>{c.ms}ms</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
