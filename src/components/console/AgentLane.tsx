import { useEffect, useRef, useState } from 'react';
import { MODEL_LABEL } from '../../lib/mockRun';
import { TENANTS } from '../../lib/tenants';
import { FIXED_H } from './ObservePanel';
import type { AgentStep, Executor, TenantKey } from '../../lib/types';

const EXEC_LABEL: Record<Executor, string> = { llm: 'LLM', code: '코드 판정', exec: '실행' };
const EXEC_STYLE: Record<Executor, { bg: string; fg: string }> = {
  llm: { bg: 'rgba(144,133,233,.16)', fg: '#9085e9' },
  code: { bg: 'rgba(255,255,255,.07)', fg: 'var(--ink-3)' },
  exec: { bg: 'rgba(217,89,38,.16)', fg: '#d95926' },
};

function Badge({ executor }: { executor: Executor }) {
  const st = EXEC_STYLE[executor];
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: '2.4px 8.4px', borderRadius: 6, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>
      {EXEC_LABEL[executor]}
    </span>
  );
}

const box = { background: 'var(--surface-2)', border: '1px solid var(--hair)', borderRadius: 10.8, padding: '12px 14.4px' };

/** 제목 중 특정 구간만 빨간 글씨로 강조한다 (i-json 제목의 '라이브 커머스' · '공용 풀 소진') */
function HighlightedTitle({ text, marks }: { text: string; marks: string[] }) {
  const escaped = marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) => (
        marks.includes(part)
          ? <span key={i} style={{ color: '#d03b3b' }}>{part}</span>
          : <span key={i}>{part}</span>
      ))}
    </>
  );
}

/** i-catalog 제목 옆에 총 개수 · 환산 규칙을 작은 회색 글씨로 이어 붙인다 */
function CatalogTitle({ title, payload }: { title: string; payload: unknown }) {
  const d = (payload ?? {}) as { catalog?: { ids: string[] }[] };
  const total = Array.isArray(d.catalog) ? d.catalog.reduce((a, r) => a + r.ids.length, 0) : 0;
  return (
    <>
      {title}
      <span>({total}개)</span>
      <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-3)', marginLeft: 7.2 }}>
        조치 1개 = 런북 1개 = 리소스 1개
      </span>
    </>
  );
}

/** 노드풀 격리 — 처음엔 공용 풀 안에 같이 있다가, 잠깐 뜸을 들인 뒤 대한통운만 아래로 뿅 떨어져 나간다 */
function NodepoolSplitViz({ split }: { split: { tenant: TenantKey; shared: TenantKey[] } }) {
  const iso = TENANTS[split.tenant];
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMoved(true), 1_500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ border: '1px solid var(--hair)', borderRadius: 12, padding: '17px 19px', background: 'var(--surface-2)' }}>
        <div style={{ fontSize: 13.4, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 11 }}>공용 노드풀</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {split.shared.map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 15.5, color: 'var(--ink-2)' }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: TENANTS[k].color, flexShrink: 0 }} />
              {TENANTS[k].label}
            </span>
          ))}
          {!moved && (
            <span
              className="pool-leaving"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 15.5, fontWeight: 700, color: iso.color }}
            >
              <span style={{ width: 11, height: 11, borderRadius: 3, background: iso.color, flexShrink: 0 }} />
              {iso.label}
            </span>
          )}
        </div>
      </div>

      {moved && (
        <>
          <div className="pool-arrow" style={{ alignSelf: 'center', color: 'var(--ink-3)', fontSize: 24, lineHeight: 1 }}>⇣</div>
          <div
            className="pool-isolated"
            style={{ border: `2px solid ${iso.color}`, borderRadius: 12, padding: '19px 21px', background: 'var(--surface-2)' }}
          >
            <div style={{ fontSize: 13.4, color: iso.color, fontWeight: 700, marginBottom: 11 }}>전용 노드풀 · 신규</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 21, fontWeight: 800, color: iso.color }}>
              <span style={{ width: 15, height: 15, borderRadius: 4, background: iso.color, flexShrink: 0 }} />
              {iso.label}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** 왜 쿼터만 올려선 안 되는가 — 근거 3종을 텍스트 체크리스트 대신 시각 카드 3장(세로)으로 */
function ReasonTrioViz({ r }: {
  r: { need: number; pool: number; slopePerMin: number; timesNormal: number; cv: number; historyNote: string };
}) {
  const gapPct = Math.min(100, (r.pool / r.need) * 100);
  const gaugePct = Math.min(100, (r.timesNormal / 4) * 100);
  return (
    <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ fontSize: 13.6, color: 'var(--ink-3)', fontWeight: 700 }}>① 조달 가능량</div>
        <div className="bar-track" style={{ height: 22, position: 'relative' }}>
          <div className="bar-fill" style={{ width: `${gapPct}%`, background: 'var(--ink-3)' }} />
          <span style={{ position: 'absolute', right: 0, top: -4, width: 2.6, height: 30, background: 'var(--crit)' }} />
        </div>
        <div className="mono" style={{ fontSize: 17 }}>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{r.pool.toLocaleString('ko-KR')}</span>
          <span style={{ color: 'var(--ink-3)' }}> / {r.need.toLocaleString('ko-KR')} rps</span>
          <span style={{ color: 'var(--crit)', fontWeight: 700, marginLeft: 12 }}>부족 {(r.need - r.pool).toLocaleString('ko-KR')} rps</span>
        </div>
      </div>

      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ fontSize: 13.6, color: 'var(--ink-3)', fontWeight: 700 }}>② 기울기 · 변동성</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div className="mono" style={{ fontSize: 34, fontWeight: 800, color: 'var(--warn)', lineHeight: 1 }}>{r.timesNormal}×</div>
          <div style={{ fontSize: 14.4, color: 'var(--ink-3)' }}>+{r.slopePerMin} rps/분 · CV {r.cv}</div>
        </div>
        <div className="bar-track" style={{ height: 14 }}>
          <div className="bar-fill" style={{ width: `${gaugePct}%`, background: 'var(--warn)' }} />
        </div>
      </div>

      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18.4" height="18.4" viewBox="0 0 24 24" fill="none" stroke="var(--crit)" strokeWidth="2.6" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" />
          </svg>
          <span style={{ fontSize: 13.6, color: 'var(--ink-3)', fontWeight: 700 }}>③ 과거 동일 상황</span>
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.55 }}>{r.historyNote}</div>
      </div>
    </div>
  );
}

const POOL_W = 640;
const POOL_H = 220;
const POOL_Y_MAX = 100;

/** 쿨다운 — RDS Proxy 풀 점유율이 위험선에서 목표선 아래로 내려오는 과정을 p99 그래프와 같은 언어로 보여준다 */
function PoolOccupancyChart({ data }: { data: { series: number[]; target: number; goal: number } }) {
  const { series, target, goal } = data;
  const xOf = (i: number) => (i / (series.length - 1)) * POOL_W;
  const yOf = (v: number) => POOL_H - (Math.min(v, POOL_Y_MAX) / POOL_Y_MAX) * POOL_H;
  const goalIdx = series.findIndex((v) => v <= goal);
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div style={{ ...box, marginTop: 9.6, padding: '16.8px 19.2px', display: 'flex', flexDirection: 'column', gap: 9.6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15.6, fontWeight: 700, color: 'var(--ink)' }}>RDS Proxy 풀 점유율</span>
        <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>목표 {goal}% 이하</span>
      </div>
      <div style={{ height: 208, position: 'relative', paddingRight: 40 }}>
        <svg viewBox={`0 0 ${POOL_W} ${POOL_H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="RDS Proxy 풀 점유율 추이">
          <line x1="0" y1={POOL_H} x2={POOL_W} y2={POOL_H} stroke="var(--rule)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          {ticks.map((v) => (
            <line key={v} x1="0" y1={yOf(v)} x2={POOL_W} y2={yOf(v)} stroke="var(--hair)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" y1={yOf(target)} x2={POOL_W} y2={yOf(target)} stroke="var(--crit)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={yOf(goal)} x2={POOL_W} y2={yOf(goal)} stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <polyline
            fill="none" stroke="var(--accent)" strokeWidth="2.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            points={series.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')}
          />
          {goalIdx >= 0 && (
            <circle cx={xOf(goalIdx)} cy={yOf(series[goalIdx])} r="4.6" fill="#16a34a" stroke="var(--surface)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {goalIdx >= 0 && (
          <span
            className="mono"
            style={{
              position: 'absolute', left: `${(goalIdx / (series.length - 1)) * 100}%`,
              top: `${(1 - series[goalIdx] / POOL_Y_MAX) * 100}%`,
              transform: 'translate(8px, -130%)', fontSize: 11.5, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap',
            }}
          >
            목표 도달 · {series[goalIdx]}%
          </span>
        )}
        <span style={{ position: 'absolute', right: 0, top: `${(1 - target / POOL_Y_MAX) * 100}%`, transform: 'translateY(-50%)', fontSize: 12, color: 'var(--crit)', whiteSpace: 'nowrap' }}>위험 {target}%</span>
        <span style={{ position: 'absolute', right: 0, top: `${(1 - goal / POOL_Y_MAX) * 100}%`, transform: 'translateY(-50%)', fontSize: 12, color: 'var(--warn)', whiteSpace: 'nowrap' }}>목표 {goal}%</span>
        {ticks.filter((v) => v !== target && v !== goal).map((v) => (
          <span key={v} style={{ position: 'absolute', right: 0, top: `${(1 - v / POOL_Y_MAX) * 100}%`, transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{v}%</span>
        ))}
      </div>
    </div>
  );
}

/* payload 모양에 따라 알아서 그린다 — 실제 에이전트 출력이 바뀌면 여기만 손보면 된다 */
function Payload({ data, stepId, stepT, now }: { data: unknown; stepId?: string; stepT?: number; now?: number }) {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (d.reasonTrio && typeof d.reasonTrio === 'object') {
    return (
      <ReasonTrioViz
        r={d.reasonTrio as { need: number; pool: number; slopePerMin: number; timesNormal: number; cv: number; historyNote: string }}
      />
    );
  }

  if (Array.isArray(d.lines)) {
    const isExec = stepId === 'i-exec';
    return (
      <>
        <div
          className="mono"
          style={{
            ...box,
            fontSize: isExec ? 17 : 13.8,
            color: 'var(--ink-2)',
            lineHeight: 1.8,
            marginTop: 9.6,
            padding: isExec ? '14.4px 14.4px' : box.padding,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {(d.lines as string[]).map((l) => <div key={l}>{l}</div>)}
        </div>
        {!!d.nodepoolSplit && (
          <NodepoolSplitViz split={d.nodepoolSplit as { tenant: TenantKey; shared: TenantKey[] }} />
        )}
      </>
    );
  }

  if (typeof d.needRps === 'number') {
    return (
      <div className="mono" style={{ ...box, marginTop: 9.6, fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.85 }}>
        <div>추세 투영    {String(d.currentRps)} + {String(d.slopePerMin)}/분 × {String(d.horizonMin)}분 = <span style={{ color: 'var(--ink)' }}>{(d.trendRps as number).toLocaleString('ko-KR')}</span></div>
        <div>이벤트 투영  baseline × 예상배수 × (과거 실측 / 예상) = <span style={{ color: 'var(--ink)' }}>{(d.eventRps as number).toLocaleString('ko-KR')}</span></div>
        <div style={{ borderTop: '1px solid var(--hair)', marginTop: 6, paddingTop: 6 }}>
          예상 RPS     max(둘) = <span style={{ color: 'var(--ink)' }}>{(d.expectedRps as number).toLocaleString('ko-KR')}</span>
        </div>
        <div>필요량       max(0, 예상 − 쿼터 {(d.quota as number).toLocaleString('ko-KR')}) = <span style={{ color: 'var(--warn)', fontWeight: 600 }}>+{String(d.needRps)} rps</span></div>
      </div>
    );
  }

  if (Array.isArray(d.donors)) {
    const rows = d.donors as { name: string; quota: number; future: number; giveable: number; risk: number; note: string }[];
    return (
      <div style={{ marginTop: 9.6, border: '1px solid var(--hair)', borderRadius: 13, overflow: 'hidden' }}>
        <div className="mono" style={{ display: 'flex', gap: 13, padding: '13px 18px', background: 'var(--surface-2)', fontSize: 14.5, color: 'var(--ink-3)' }}>
          <span style={{ flexGrow: 1 }}>도너</span>
          <span style={{ width: 76, textAlign: 'right' }}>쿼터</span>
          <span style={{ width: 76, textAlign: 'right' }}>미래</span>
          <span style={{ width: 74, textAlign: 'right' }}>가용량</span>
          <span style={{ width: 64, textAlign: 'right' }}>위험도</span>
        </div>
        {rows.map((r) => {
          const hot = r.risk >= 60;
          return (
            <div key={r.name} style={{ padding: '18px', borderTop: '1px solid var(--hair)' }}>
              <div className="mono" style={{ display: 'flex', gap: 13, fontSize: 17 }}>
                <span style={{ flexGrow: 1, color: 'var(--ink)', fontWeight: 700 }}>{r.name}</span>
                <span style={{ width: 76, textAlign: 'right', color: 'var(--ink-3)' }}>{r.quota.toLocaleString('ko-KR')}</span>
                <span style={{ width: 76, textAlign: 'right', color: 'var(--ink-3)' }}>−{r.future.toLocaleString('ko-KR')}</span>
                <span style={{ width: 74, textAlign: 'right', color: 'var(--ink)', fontWeight: 700 }}>{r.giveable}</span>
                <span style={{ width: 64, textAlign: 'right', fontWeight: 700, color: hot ? 'var(--crit)' : 'var(--ink-2)' }}>{r.risk}</span>
              </div>
              <div style={{ fontSize: 14.2, color: hot ? 'var(--crit)' : 'var(--ink-3)', marginTop: 5.6 }}>{r.note}</div>
            </div>
          );
        })}
        <div style={{ padding: '13px 18px', borderTop: '1px solid var(--hair)', fontSize: 13.6, color: 'var(--ink-3)' }}>
          위험도 = 추세 0.3 + 이벤트 0.4 + 변동성 0.3
        </div>
      </div>
    );
  }

  if (Array.isArray(d.combos)) {
    const rows = d.combos as { label: string; total: number; chosen: boolean; reason: string }[];
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 7.2 }}>
        {rows.map((c) => (
          <div key={c.label} style={{ padding: '10.8px 13.2px', borderRadius: 9.6, background: c.chosen ? 'rgba(144,133,233,.14)' : 'var(--surface-2)', border: c.chosen ? '1px solid #9085e9' : '1px solid transparent' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.6 }}>
              <span style={{ fontSize: 15, fontWeight: c.chosen ? 700 : 400, color: c.chosen ? 'var(--ink)' : 'var(--ink-3)', flexGrow: 1 }}>
                {c.label}{c.chosen && ' — 선택'}
              </span>
              <span className="mono" style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>합 {c.total}</span>
            </div>
            <div style={{ fontSize: 13.2, color: 'var(--ink-3)', marginTop: 3.6 }}>{c.reason}</div>
          </div>
        ))}
        <div style={{ fontSize: 13.2, color: 'var(--ink-3)', lineHeight: 1.7 }}>
          · {String(d.note)}<br />· {String(d.fallback)}
        </div>
      </div>
    );
  }

  if (typeof d.needs_action === 'boolean') {
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div style={{ display: 'flex', gap: 9.6 }}>
          <span className="chip chip-crit">needs_action = true</span>
          <span className="mono" style={{ fontSize: 13.2, color: 'var(--ink-3)', alignSelf: 'center' }}>
            priority_score {String(d.priority_score)}
          </span>
        </div>
        <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(d.evidence as string[]).map((e) => (
            <div key={e} style={{ fontSize: 14.4, color: 'var(--ink-2)' }}>· {e}</div>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(d.options)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10.8, marginTop: 9.6 }}>
        {(d.options as { name: string; verdict: string; note: string }[]).map((o) => {
          const on = o.verdict === '채택';
          return (
            <div
              key={o.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 14.4, padding: '19.2px 20px', borderRadius: 11,
                background: on ? 'rgba(57,135,229,.12)' : 'var(--surface-2)',
                border: on ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--accent)' : 'var(--ink-3)', width: 40, flexShrink: 0 }}>{o.verdict}</span>
              <div style={{ fontSize: 19, lineHeight: 1.4, color: on ? 'var(--ink)' : 'var(--ink-3)', fontWeight: on ? 700 : 500, minWidth: 0 }}>{o.name}</div>
            </div>
          );
        })}
      </div>
    );
  }

  if (Array.isArray(d.runbooks)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9.6 }}>
        {(d.runbooks as { id: string; name: string; chosen: boolean; reason: string }[]).map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10.8, padding: '9.6px 13.2px', borderRadius: 9.6, background: r.chosen ? 'rgba(217,89,38,.14)' : 'var(--surface-2)', border: r.chosen ? '1px solid #d95926' : '1px solid transparent' }}>
            <span className="mono" style={{ fontSize: 12.6, color: r.chosen ? '#d95926' : 'var(--ink-3)', width: 48, flexShrink: 0, paddingTop: 2.4, fontWeight: 600 }}>{r.id}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: r.chosen ? 700 : 400, color: r.chosen ? 'var(--ink)' : 'var(--ink-3)' }}>
                {r.name}{r.chosen && ' — 선택'}
              </div>
              <div style={{ fontSize: 13.2, color: 'var(--ink-3)', marginTop: 2.4 }}>{r.reason}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(d.checks)) {
    const isVerify = stepId === 'i-verify';
    const labelSize = isVerify ? 17.3 : 14.4;
    const noteSize = isVerify ? 15.1 : 12.6;
    const iconSize = isVerify ? 17.3 : 14.4;
    return (
      <>
        <div style={{ ...box, marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: isVerify ? 14.4 : 7.2, padding: isVerify ? '19.2px 21.6px' : box.padding }}>
          {(d.checks as { n: string; label: string; ok: boolean; note?: string }[]).map((c) => (
            <div key={c.n} style={{ display: 'flex', flexDirection: 'column', gap: isVerify ? 5.4 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9.6, fontSize: labelSize }}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={c.ok ? 'var(--good)' : 'var(--crit)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="m5 12.5 4.5 4.5L19 7" />
                </svg>
                <span style={{ color: 'var(--ink-2)', flexGrow: 1 }}>{c.n} {c.label}</span>
                {c.note && !isVerify && <span className="mono" style={{ fontSize: noteSize, color: 'var(--ink-3)' }}>{c.note}</span>}
              </div>
              {c.note && isVerify && (
                <span className="mono" style={{ fontSize: noteSize, color: 'var(--ink-3)', marginLeft: iconSize + 9.6 }}>{c.note}</span>
              )}
            </div>
          ))}
          {d.poolChart && typeof d.poolChart === 'object'
            ? <PoolOccupancyChart data={d.poolChart as { series: number[]; target: number; goal: number }} />
            : null}
        </div>
        {isVerify && (
          <div style={{ marginTop: 9.6, fontSize: noteSize, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            · 신뢰 불가일 경우 : 재진단 1회(도구 추가 조회 지시)<br />· 2회 실패 : 사람에게 보고 후 중단
          </div>
        )}
      </>
    );
  }

  if (typeof d.direct_cause === 'string') {
    return (
      <div style={{ ...box, marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div className="mono" style={{ fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <div>tenant        {String(d.tenant)}   occurred_at  {String(d.occurred_at)}</div>
          <div>symptom       {String(d.symptom)}</div>
          <div>direct_cause  <span style={{ color: 'var(--ink)' }}>{String(d.direct_cause)}</span></div>
          <div>root_cause    <span style={{ color: 'var(--ink)' }}>{String(d.root_cause)}</span></div>
        </div>
      </div>
    );
  }

  if (Array.isArray(d.groups)) {
    // '사용한 도구' — 메트릭·로그·커넥션 풀을 동시에, 각각 대제목으로 구분해서 보여준다
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10.8, marginTop: 9.6 }}>
        {(d.groups as { heading: string; lines: string[] }[]).map((g) => (
          <div key={g.heading} style={box}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7.2 }}>{g.heading}</div>
            <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.6, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              {g.lines.map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(d.tools)) {
    const rows = d.tools as { name: string; src: string; calls: number }[];
    return (
      <div style={{ marginTop: 9.6, border: '1px solid var(--hair)', borderRadius: 10.8, overflow: 'hidden' }}>
        {rows.map((t) => (
          <div key={t.name} className="mono" style={{ display: 'flex', gap: 9.6, padding: '8.4px 13.2px', fontSize: 13.8, borderBottom: '1px solid var(--hair)' }}>
            <span style={{ color: 'var(--ink)', width: 153.6, flexShrink: 0 }}>{t.name}</span>
            <span style={{ color: 'var(--ink-3)', flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.src}</span>
            <span style={{ color: '#9085e9', fontWeight: 600 }}>{t.calls}회</span>
          </div>
        ))}
        <div style={{ padding: '8.4px 13.2px', display: 'flex', gap: 9.6, fontSize: 12.6, color: 'var(--ink-3)' }}>
          <span style={{ flexGrow: 1 }}>미호출 — {(d.idle as string[]).join(' · ')}</span>
          <span className="mono">합 {String(d.total)}회</span>
        </div>
      </div>
    );
  }

  if (Array.isArray(d.milestones) && typeof d.expected === 'string') {
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 14.4, padding: '20px 22px' }}>
          <div><span style={{ fontSize: 17, color: 'var(--ink-3)', fontWeight: 700 }}>① 예상 결과</span>
            <div style={{ fontSize: 17, marginTop: 5, fontWeight: 600 }}>{d.expected as string}</div></div>
          <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 12 }}>
            <span style={{ fontSize: 17, color: 'var(--ink-3)', fontWeight: 700 }}>② 마일스톤</span>
            {(d.milestones as string[]).map((m, i) => (
              <div key={m} style={{ fontSize: 17, marginTop: 5, fontWeight: 600 }}>{i + 1}. {m}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (Array.isArray(d.catalog)) {
    const rows = d.catalog as { ids: string[]; name: string; tag?: string; chosen?: boolean }[];
    const cap = typeof d.catalogCap === 'number' ? d.catalogCap : 5;
    // 그룹으로 묶인 id(예: RB-06·RB-07)도 화면에는 번호 1~13 을 하나씩 매겨 펼친다 — 1열 1~7 · 2열 8~13, 스크롤 없이 한 화면
    const flat: { n: number; id: string; name: string; tag?: string; chosen?: boolean }[] = [];
    rows.forEach((r) => {
      r.ids.forEach((id) => flat.push({ n: flat.length + 1, id, name: r.name, tag: r.tag, chosen: r.chosen }));
    });
    const columns = [flat.slice(0, 7), flat.slice(7)];

    // 고른 순서대로 하나씩 초록으로 켜지며 '조합 n/cap' 이 0 → 1 → 2 → 3 으로 따라 올라간다
    const REVEAL_DELAYS = [1_500, 3_500, 5_500];
    const elapsed = typeof stepT === 'number' && typeof now === 'number' ? now - stepT : Infinity;
    const revealedCount = REVEAL_DELAYS.filter((ms) => elapsed >= ms).length;
    let chosenSeen = 0;

    return (
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 7.2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.6, flexWrap: 'wrap' }}>
          <span style={{ flexGrow: 1 }} />
          <span className="mono" style={{ fontSize: 16.2, fontWeight: 700, color: revealedCount > 0 ? '#16a34a' : 'var(--ink-3)', transition: 'color .3s ease' }}>조합 {revealedCount}/{cap}</span>
        </div>
        <div style={{ display: 'flex', gap: 18 }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              {col.map((it) => {
                const rank = it.chosen ? chosenSeen++ : -1;
                const revealed = rank >= 0 && rank < revealedCount;
                const on = !it.chosen ? false : revealed;
                return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9.6, padding: '7.2px 13.2px', borderRadius: 9.6,
                      border: on ? '1.5px solid #16a34a' : '1px solid var(--hair)',
                      background: on ? 'rgba(22,163,74,.14)' : 'var(--surface-2)',
                      minWidth: 0,
                      transition: 'background .4s ease, border-color .4s ease',
                    }}
                  >
                    <span className="mono" style={{ fontSize: 12.6, fontWeight: 700, color: on ? '#16a34a' : 'var(--ink-3)', flexShrink: 0, width: 17 }}>{it.n}</span>
                    <span className="mono" style={{ fontSize: 13.8, fontWeight: 700, color: on ? '#16a34a' : 'var(--ink-3)', flexShrink: 0 }}>{it.id}</span>
                    <span style={{ fontSize: 14.6, color: on ? 'var(--ink)' : 'var(--ink-3)', flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                    {it.tag && <span style={{ fontSize: 12.2, fontStyle: 'italic', color: 'var(--ink-3)', flexShrink: 0 }}>({it.tag})</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (Array.isArray(d.steps) && d.verify) {
    const v = d.verify as { promql: string; operator: string; threshold: number };
    return (
      <div className="mono" style={{ ...box, marginTop: 9.6, fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.8 }}>
        <div>steps        {(d.steps as string[])[0]}</div>
        <div>rollback     {String(d.rollback_plan)}</div>
        <div>blast        {String(d.blast_radius)}</div>
        <div>verify       p99 {v.operator} {v.threshold}ms</div>
      </div>
    );
  }

  if (typeof d.tier === 'number') {
    return (
      <div className="mono" style={{ ...box, marginTop: 9.6, fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.8 }}>
        {(d.lines as string[]).map((l) => <div key={l}>{l}</div>)}
      </div>
    );
  }

  if (typeof d.branchA === 'string') {
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 7.2 }}>
        <div style={{ ...box, fontSize: 13.8, color: 'var(--ink-2)' }}>A · {String(d.branchA)}</div>
        <div style={{ ...box, fontSize: 13.8, color: 'var(--ink-2)' }}>B · {String(d.branchB)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9.6, background: 'rgba(12,163,12,.10)', border: '1px solid rgba(12,163,12,.32)', borderRadius: 10.8, padding: '9.6px 13.2px' }}>
          <svg width="15.6" height="15.6" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
          <span style={{ fontSize: 14.4 }}>{String(d.approvedBy)} 승인 · {String(d.approvedInSec)}초</span>
        </div>
      </div>
    );
  }

  if (typeof d.resolved === 'boolean') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10.8, marginTop: 9.6, background: 'rgba(12,163,12,.10)', border: '1px solid rgba(12,163,12,.32)', borderRadius: 10.8, padding: '10.8px 14.4px' }}>
        <svg width="16.8" height="16.8" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
        <span className="mono" style={{ fontSize: 14.4 }}>
          p99 {String(d.observed)}ms {String(d.operator)} {String(d.threshold)}ms → resolved = true
        </span>
      </div>
    );
  }

  return null;
}

export default function AgentLane({
  title, subtitle, steps, width, empty, verdict, chain = [], t,
}: {
  title: string;
  subtitle: string;
  steps: AgentStep[];
  width?: number;
  empty: string;
  /** 이번 실행의 판정 — 정확도는 사후 배치 평가에서 나오므로 실행 중엔 이걸 쓴다 */
  verdict?: string;
  /** 단계가 바뀌어도 남는 것 — 지금까지 확정된 사실 */
  chain?: { label: string; value: string; state: 'done' | 'now' | 'todo' }[];
  /** 리플레이 현재 시각 — i-catalog 의 조합 선택 순차 애니메이션에 쓴다 */
  t?: number;
}) {
  const model = steps.find((s) => s.model)?.model;
  // i-hitl 은 팝업(HitlPopup)에서 전부 보여주므로 로그에는 중복 표시하지 않는다 — 트리거용 데이터는 steps 에 그대로 남아있다
  const visibleSteps = steps.filter((s) => s.id !== 'i-hitl');
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [visibleSteps.length]);

  return (
    <div
      className="card"
      style={{
        width, flexGrow: width ? undefined : 1, flexShrink: 1,
        display: 'flex', flexDirection: 'column', padding: 0,
        minHeight: 0, minWidth: 0, overflow: 'hidden',
      }}
    >
      {/* 고정 머리 — 왼쪽 쿼터 카드 하단과 끝이 맞는다.
          단계가 바뀌어도 여기 있는 것들은 안 사라진다. */}
      <div
        style={{
          height: FIXED_H, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
          padding: '13px 20.3px 12px', borderBottom: '1px solid var(--hair)', background: 'var(--surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 11.1, flexShrink: 0 }}>
          <span style={{ fontSize: 16.6, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</span>
          <span style={{ fontSize: 12.9, color: 'var(--ink-3)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
          <span style={{ flexGrow: 1 }} />
          {model && (
            <span className="mono" title={model} style={{ fontSize: 12.7, color: '#9085e9', background: 'rgba(144,133,233,.14)', padding: '3.5px 10.5px', borderRadius: 7, whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}>
              {MODEL_LABEL}
            </span>
          )}
          {verdict && (
            <span style={{ fontSize: 13.2, color: 'var(--ink-2)', background: 'rgba(255,255,255,.06)', padding: '3.5px 10.5px', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {verdict}
            </span>
          )}
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
          {chain.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: c.state === 'todo' ? 0.38 : 1 }}>
              <span style={{ width: 13, flexShrink: 0, fontSize: 13, fontWeight: 700, color: c.state === 'done' ? '#16a34a' : c.state === 'now' ? 'var(--warn)' : 'var(--ink-3)' }}>
                {c.state === 'todo' ? '·' : '✓'}
              </span>
              <span style={{ width: 74, flexShrink: 0, fontSize: 12.4, color: 'var(--ink-3)' }}>{c.label}</span>
              <span
                className="mono"
                style={{ fontSize: 13.6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.state === 'now' ? 'var(--ink)' : 'var(--ink-2)', fontWeight: c.state === 'now' ? 700 : 400 }}
              >
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={boxRef}
        style={{
          flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          padding: '14.8px 20.3px 18.5px', display: 'flex', flexDirection: 'column', gap: 11.1,
        }}
      >
      {visibleSteps.length === 0 && (
        <div style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7 }}>
          {empty}<span className="dots">.....</span>
        </div>
      )}

      {visibleSteps.map((s, si) => {
        // 사용률 재확인 카운터 스텝 — 체크·시간 배지 없이 "(1/3)" + 그 아래 상세 내용까지 통째로 한 단위로 쌓이며 내려간다
        const counterPayload = s.payload as { counter?: number; total?: number; lines?: string[] } | undefined;
        if (typeof counterPayload?.counter === 'number' && typeof counterPayload?.total === 'number') {
          return (
            <div key={s.id} className="log-enter">
              <div style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                사용률 재확인 ({counterPayload.counter}/{counterPayload.total})
              </div>
              {Array.isArray(counterPayload.lines) && (
                <div className="mono" style={{ ...box, fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.8, marginTop: 7.2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {counterPayload.lines.map((l) => <div key={l}>{l}</div>)}
                </div>
              )}
            </div>
          );
        }

        // 쿨다운 헤더(q-cool)는 뒤에 모니터링 로그가 쌓여도 접히지 않고 맨 위 '메인 글'로 고정된다
        // '수집 소스 스캔'(i-collect)도 접히지 않는다 — 뒤이어 '장애 등급 산출' · '프롬프트 제작' 이 쌓여도 무엇을 모았는지는 계속 보여야 한다
        const folded = si < visibleSteps.length - 1 && s.id !== 'q-cool' && s.id !== 'i-collect';
        if (folded) {
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9.6, opacity: 0.5, transition: 'opacity .45s ease' }}>
              <span style={{ fontSize: 12.6, fontWeight: 700, color: '#16a34a' }}>✓</span>
              <span style={{ fontSize: 13.6, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>+{(s.t / 1000).toFixed(0)}s</span>
            </div>
          );
        }
        return (
          <div key={s.id} className="log-enter log-flash" style={{ padding: '3px 8px', margin: '-3px -8px', transition: 'opacity .3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9.6, flexWrap: 'wrap' }}>
              <Badge executor={s.executor} />
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>+{(s.t / 1000).toFixed(0)}s</span>
            </div>
            <div
              style={{
                fontSize: 19, fontWeight: 600, marginTop: 6,
                whiteSpace: s.id === 'q-donors' ? 'nowrap' : undefined,
                overflow: s.id === 'q-donors' ? 'hidden' : undefined,
                textOverflow: s.id === 'q-donors' ? 'ellipsis' : undefined,
              }}
            >
              {s.id === 'i-json'
                ? <HighlightedTitle text={s.title} marks={['라이브 커머스', '공용 풀 소진']} />
                : s.id === 'i-catalog'
                ? <CatalogTitle title={s.title} payload={s.payload} />
                : s.title}
            </div>
            <Payload data={s.payload} stepId={s.id} stepT={s.t} now={t} />
            <div style={{ height: 16.8 }} />
          </div>
        );
      })}
      </div>
    </div>
  );
}
