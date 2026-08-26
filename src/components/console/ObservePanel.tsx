import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import type { PosCall, Projection, TenantSample } from '../../lib/types';

export interface Usage {
  inTok: number;
  outTok: number;
  calls: number;
  costUsd: number;
}

/* 이 컬럼은 두 에이전트가 공유하는 상황판이라 다른 곳보다 크게 잡는다 (약 130%) */
const PLOT_W = 560;
const PLOT_H = 74;
const Y_MAX = 900;

interface Props {
  samples: TenantSample[];
  idx: number;
  sloMs: number;
  projection: Projection;
  posCalls: PosCall[];
  tenantTotal: number;
  usage: Usage;
}

export default function ObservePanel({ samples, idx, sloMs, projection, posCalls, tenantTotal, usage }: Props) {
  const sample = samples[idx] ?? samples[0];
  const shown = samples.slice(0, idx + 1);
  const xOf = (i: number) => (i / (samples.length - 1)) * PLOT_W;
  const yOf = (v: number) => PLOT_H - (Math.min(v, Y_MAX) / Y_MAX) * PLOT_H;

  return (
    <div style={{ flex: '4 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9.2, minHeight: 0, overflow: 'hidden' }}>

      {/* p99 시계열 — 격리 주장 그 자체 */}
      <div className="card" style={{ flexShrink: 0, padding: '12px 15.7px', display: 'flex', flexDirection: 'column', gap: 8.3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>테넌트별 p99</span>
          <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>SLO {sloMs}ms</span>
          <span style={{ flexGrow: 1 }} />
          {TENANT_ORDER.map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4.6 }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: TENANTS[k].color }} />
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{TENANTS[k].label}</span>
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 ${PLOT_W + 44} ${PLOT_H + 22}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="테넌트별 p99 시계열">
          <g transform="translate(0,8)">
            <line x1="0" y1={PLOT_H} x2={PLOT_W} y2={PLOT_H} stroke="var(--rule)" strokeWidth="1.3" />
            <line x1="0" y1={yOf(sloMs)} x2={PLOT_W} y2={yOf(sloMs)} stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="5 4" />
            <text x={PLOT_W + 6} y={yOf(sloMs) + 5} fill="var(--warn)" fontSize="13" fontFamily="IBM Plex Sans KR, sans-serif">SLO</text>
            {TENANT_ORDER.map((k) => (
              <polyline
                key={k}
                fill="none"
                stroke={TENANTS[k].color}
                strokeWidth={k === 'cgv' ? 2.8 : 2}
                strokeLinejoin="round"
                points={shown.map((s, i) => `${xOf(i).toFixed(1)},${yOf(s.p99[k]).toFixed(1)}`).join(' ')}
              />
            ))}
            {shown.length > 1 && TENANT_ORDER.map((k) => (
              <circle key={k} cx={xOf(shown.length - 1)} cy={yOf(sample.p99[k])} r="4" fill={TENANTS[k].color} stroke="var(--surface)" strokeWidth="2" />
            ))}
          </g>
        </svg>
      </div>

      {/* 리소스 — 에이전트가 실제로 쓰는 비용. 상주 인프라 대비 우위가 설계 논거다 */}
      <div className="card" style={{ flexShrink: 0, padding: '11px 17px', display: 'flex', alignItems: 'center', gap: 14 }}>
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

      {/* 필요량 — Agent 1 의 결정론 계산 결과 */}
      <div className="card" style={{ flexShrink: 0, padding: '12px 15.7px', display: 'flex', flexDirection: 'column', gap: 8.3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>필요량 산출</span>
          <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>
            {TENANTS[projection.tenant].label} · {projection.horizonMin}분 지평 · 결정론
          </span>
        </div>

        <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 4.6, fontSize: 13.8, color: 'var(--ink-2)' }}>
          <div style={{ display: 'flex' }}>
            <span style={{ flexGrow: 1 }}>추세 투영 <span style={{ color: 'var(--ink-3)' }}>현재 + {projection.slopePerMin}/분 × {projection.horizonMin}</span></span>
            <span>{projection.trendRps.toLocaleString('ko-KR')}</span>
          </div>
          <div style={{ display: 'flex' }}>
            <span style={{ flexGrow: 1 }}>이벤트 투영 <span style={{ color: 'var(--ink-3)' }}>baseline × 배수 × 보정</span></span>
            <span>{projection.eventRps.toLocaleString('ko-KR')}</span>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid var(--hair)', paddingTop: 6.5, color: 'var(--ink)' }}>
            <span style={{ flexGrow: 1 }}>예상 RPS <span style={{ color: 'var(--ink-3)' }}>max</span></span>
            <span style={{ fontWeight: 600 }}>{projection.expectedRps.toLocaleString('ko-KR')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16.6, borderTop: '1px solid var(--hair)', paddingTop: 8.3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2.8 }}>
            <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>필요량</span>
            <span className="mono" style={{ fontSize: 23.1, fontWeight: 600, color: 'var(--warn)' }}>+{projection.needRps} rps</span>
          </div>
          <div style={{ width: 1, height: 38, background: 'var(--hair)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2.8 }}>
            <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>파이 여유</span>
            <span className="mono" style={{ fontSize: 23.1, fontWeight: 600 }}>{projection.poolFreeRps} rps</span>
          </div>
          <div style={{ flexGrow: 1 }} />
          <span className="chip chip-good" style={{ fontSize: 12, padding: '3.7px 10.2px' }}>파이 안에서 조달 가능</span>
        </div>
      </div>

      {/* 테넌트 쿼터 사용률 */}
      <div className="card" style={{ flexShrink: 0, padding: '12px 15.7px', display: 'flex', flexDirection: 'column', gap: 8.3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>쿼터 사용률</span>
          <span style={{ flexGrow: 1 }} />
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>4 / {tenantTotal} 테넌트 · 대표 유형</span>
        </div>
        {TENANT_ORDER.map((k) => {
          const pct = Math.min(100, (sample.qps[k] / sample.quotaLimit[k]) * 100);
          const hot = pct >= 80;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9.2 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: TENANTS[k].color, flexShrink: 0 }} />
              <span style={{ width: 80, fontSize: 13.8, color: hot ? '#d03b3b' : 'var(--ink)', fontWeight: hot ? 700 : 400 }}>{TENANTS[k].label}</span>
              <div className="bar-track" style={{ flexGrow: 1, height: 15, position: 'relative' }}>
                <div className="bar-fill" style={{ width: `${pct}%`, background: TENANTS[k].color }} />
                <span style={{ position: 'absolute', left: '80%', top: hot ? -4 : -3, width: hot ? 2.5 : 1.5, height: hot ? 24 : 22, background: hot ? '#d03b3b' : 'var(--rule)' }} />
              </div>
              <span className="mono" style={{ width: 120, textAlign: 'right', fontSize: 13.8, color: hot ? '#d03b3b' : 'var(--ink-2)', fontWeight: hot ? 700 : 400 }}>
                {sample.qps[k].toLocaleString('ko-KR')}/{sample.quotaLimit[k].toLocaleString('ko-KR')}
              </span>
            </div>
          );
        })}
      </div>

      {/* 실제 POS 호출 */}
      <div className="card" style={{ flexGrow: 1, padding: '12px 15.7px', display: 'flex', flexDirection: 'column', gap: 6.5, minHeight: 116, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2 }}>
          <span style={{ fontSize: 15.7, fontWeight: 600 }}>실제 POS 호출</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>다른 창에서 누른 요청</span>
        </div>
        {posCalls.length === 0 ? (
          <span style={{ fontSize: 13.8, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            POS 창에서 버튼을 누르면 trace id 와 함께 여기 찍힙니다.
          </span>
        ) : (
          posCalls.slice(0, 3).map((c) => (
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
