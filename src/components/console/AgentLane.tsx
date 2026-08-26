import { useEffect, useRef } from 'react';
import { MODEL_LABEL } from '../../lib/mockRun';
import type { AgentStep, Executor, Phase } from '../../lib/types';

const EXEC_LABEL: Record<Executor, string> = { llm: 'LLM', code: '코드 판정', exec: '실행' };
const EXEC_STYLE: Record<Executor, { bg: string; fg: string }> = {
  llm: { bg: 'rgba(144,133,233,.16)', fg: '#9085e9' },
  code: { bg: 'rgba(255,255,255,.07)', fg: 'var(--ink-3)' },
  exec: { bg: 'rgba(217,89,38,.16)', fg: '#d95926' },
};
const PHASE_LABEL: Record<Phase, string> = {
  monitor: '모니터링', diagnose: '진단', act: '조치', improve: '자기개선',
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

/* payload 모양에 따라 알아서 그린다 — 실제 에이전트 출력이 바뀌면 여기만 손보면 된다 */
function Payload({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (Array.isArray(d.lines)) {
    return (
      <div className="mono" style={{ ...box, fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.8, marginTop: 9.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {(d.lines as string[]).map((l) => <div key={l}>{l}</div>)}
      </div>
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
      <div style={{ marginTop: 9.6, border: '1px solid var(--hair)', borderRadius: 10.8, overflow: 'hidden' }}>
        <div className="mono" style={{ display: 'flex', gap: 9.6, padding: '8.4px 13.2px', background: 'var(--surface-2)', fontSize: 12.6, color: 'var(--ink-3)' }}>
          <span style={{ flexGrow: 1 }}>도너</span>
          <span style={{ width: 55.2, textAlign: 'right' }}>쿼터</span>
          <span style={{ width: 55.2, textAlign: 'right' }}>미래</span>
          <span style={{ width: 62.4, textAlign: 'right' }}>줄 수 있음</span>
          <span style={{ width: 48, textAlign: 'right' }}>위험도</span>
        </div>
        {rows.map((r) => {
          const hot = r.risk >= 60;
          return (
            <div key={r.name} style={{ padding: '9.6px 13.2px', borderTop: '1px solid var(--hair)' }}>
              <div className="mono" style={{ display: 'flex', gap: 9.6, fontSize: 13.8 }}>
                <span style={{ flexGrow: 1, color: 'var(--ink)' }}>{r.name}</span>
                <span style={{ width: 55.2, textAlign: 'right', color: 'var(--ink-3)' }}>{r.quota.toLocaleString('ko-KR')}</span>
                <span style={{ width: 55.2, textAlign: 'right', color: 'var(--ink-3)' }}>−{r.future.toLocaleString('ko-KR')}</span>
                <span style={{ width: 62.4, textAlign: 'right', color: 'var(--ink)', fontWeight: 600 }}>{r.giveable}</span>
                <span style={{ width: 48, textAlign: 'right', fontWeight: 700, color: hot ? 'var(--crit)' : 'var(--ink-2)' }}>{r.risk}</span>
              </div>
              <div style={{ fontSize: 12.6, color: hot ? 'var(--crit)' : 'var(--ink-3)', marginTop: 3.6 }}>{r.note}</div>
            </div>
          );
        })}
        <div style={{ padding: '8.4px 13.2px', borderTop: '1px solid var(--hair)', fontSize: 12.6, color: 'var(--ink-3)' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9.6 }}>
        {(d.options as { name: string; verdict: string; note: string }[]).map((o) => {
          const on = o.verdict === '채택';
          return (
            <div key={o.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10.8, padding: '9.6px 13.2px', borderRadius: 9.6, background: on ? 'rgba(57,135,229,.12)' : 'var(--surface-2)', border: on ? '1px solid var(--t-cgv)' : '1px solid transparent' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: on ? 'var(--t-cgv)' : 'var(--ink-3)', width: 31.2, flexShrink: 0, paddingTop: 1.2 }}>{o.verdict}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, color: on ? 'var(--ink)' : 'var(--ink-3)', fontWeight: on ? 600 : 400 }}>{o.name}</div>
                <div style={{ fontSize: 13.2, color: 'var(--ink-3)', marginTop: 2.4 }}>{o.note}</div>
              </div>
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
    return (
      <div style={{ ...box, marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 7.2 }}>
        {(d.checks as { n: string; label: string; ok: boolean; note?: string }[]).map((c) => (
          <div key={c.n} style={{ display: 'flex', alignItems: 'center', gap: 9.6, fontSize: 14.4 }}>
            <svg width="14.4" height="14.4" viewBox="0 0 24 24" fill="none" stroke={c.ok ? 'var(--good)' : 'var(--crit)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
            <span style={{ color: 'var(--ink-2)', flexGrow: 1 }}>{c.n} {c.label}</span>
            {c.note && <span className="mono" style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>{c.note}</span>}
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 8.4, fontSize: 13.2, color: 'var(--ink-3)' }}>
          {d.footer
            ? String(d.footer)
            : `①~④ 미충족이면 재시도 1회 → 그래도 실패하면 Slack 통보 후 종료 (현재 attempt ${String(d.attempt)})`}
        </div>
      </div>
    );
  }

  if (typeof d.direct_cause === 'string') {
    return (
      <div style={{ ...box, marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div className="mono" style={{ fontSize: 13.8, color: 'var(--ink-2)', lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <div>tenant        {String(d.tenant)}   occurred_at  {String(d.occurred_at)}</div>
          <div>symptom       {String(d.symptom)}</div>
          <div>direct_cause  <span style={{ color: 'var(--ink)' }}>{String(d.direct_cause)}</span></div>
          <div>root_cause    <span style={{ color: 'var(--ink)' }}>{String(d.root_cause)}</span></div>
          <div>tool_calls    {String(d.tool_calls)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4.8, borderTop: '1px solid var(--hair)', paddingTop: 8.4 }}>
          <div style={{ fontSize: 12.6, color: 'var(--ink-3)', letterSpacing: '.04em' }}>evidence[] — 도구 호출과 결과</div>
          {(d.evidence as string[]).map((e) => (
            <div key={e} className="mono" style={{ fontSize: 13.2, color: 'var(--ink-2)', wordBreak: 'break-word' }}>· {e}</div>
          ))}
        </div>
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
    const plan = d.plan as { id: string; name: string; param: string }[];
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8.4 }}>
          <div><span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>① 예상 결과</span>
            <div style={{ fontSize: 15, marginTop: 2.4 }}>{d.expected as string}</div></div>
          <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 8.4 }}>
            <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>② 마일스톤</span>
            {(d.milestones as string[]).map((m, i) => (
              <div key={m} style={{ fontSize: 15, marginTop: 2.4 }}>{i + 1}. {m}</div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 8.4 }}>
            <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>③ 런북 조합 — 순서 · 파라미터</span>
            {plan.map((r, i) => (
              <div key={r.id} className="mono" style={{ fontSize: 13.8, marginTop: 3.6, display: 'flex', gap: 9.6 }}>
                <span style={{ color: '#d95926', fontWeight: 600 }}>{i + 1}. {r.id}</span>
                <span style={{ color: 'var(--ink)', flexGrow: 1 }}>{r.name}</span>
                <span style={{ color: 'var(--ink-3)' }}>{r.param}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--hair)', paddingTop: 8.4, display: 'flex' }}>
            <span style={{ fontSize: 12.6, color: 'var(--ink-3)', flexGrow: 1 }}>④ 모니터링 시간</span>
            <span className="mono" style={{ fontSize: 14.4 }}>{String(d.monitorSec)}초</span>
          </div>
        </div>
      </div>
    );
  }

  if (Array.isArray(d.catalog)) {
    const rows = d.catalog as { id: string; name: string; chosen?: boolean }[];
    return (
      <div style={{ marginTop: 9.6, display: 'flex', flexDirection: 'column', gap: 9.6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 4.8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              className="mono"
              style={{
                display: 'flex', gap: 7.2, padding: '6px 9.6px', borderRadius: 7.2, fontSize: 12.6,
                background: r.chosen ? 'rgba(217,89,38,.16)' : 'var(--surface-2)',
                color: r.chosen ? 'var(--ink)' : 'var(--ink-3)',
                border: r.chosen ? '1px solid #d95926' : '1px solid transparent',
              }}
            >
              <span style={{ fontWeight: 600, color: r.chosen ? '#d95926' : 'var(--ink-3)' }}>{r.id}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13.2, color: 'var(--ink-3)', lineHeight: 1.7 }}>{String(d.note)}</div>
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
  title, subtitle, steps, width, empty, verdict,
}: {
  title: string;
  subtitle: string;
  steps: AgentStep[];
  width?: number;
  empty: string;
  /** 이번 실행의 판정 — 정확도는 사후 배치 평가에서 나오므로 실행 중엔 이걸 쓴다 */
  verdict?: string;
}) {
  const model = steps.find((s) => s.model)?.model;
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps.length]);

  let lastPhase: Phase | null = null;

  return (
    <div
      className="card"
      style={{
        width, flexGrow: width ? undefined : 1, flexShrink: 0,
        display: 'flex', flexDirection: 'column', padding: 0,
        minHeight: 0, minWidth: 0, overflow: 'hidden',
      }}
    >
      {/* 헤더는 스크롤 밖에 둔다 — sticky 로 겹치면 글자가 깨진다 */}
      <div
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 11.1,
          padding: '15.7px 20.3px 12px', borderBottom: '1px solid var(--hair)',
          background: 'var(--surface)',
        }}
      >
        <span style={{ fontSize: 16.6, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ fontSize: 12.9, color: 'var(--ink-3)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</span>
        <span style={{ flexGrow: 1 }} />
        {model && (
          <span
            className="mono"
            title={model}
            style={{
              fontSize: 12.7, color: '#9085e9', background: 'rgba(144,133,233,.14)',
              padding: '3.5px 10.5px', borderRadius: 7, whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0,
            }}
          >
            {MODEL_LABEL}
          </span>
        )}
        {verdict && (
          <span style={{ fontSize: 13.2, color: 'var(--ink-2)', background: 'rgba(255,255,255,.06)', padding: '3.5px 10.5px', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {verdict}
          </span>
        )}
      </div>

      <div
        ref={boxRef}
        style={{
          flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          padding: '14.8px 20.3px 18.5px', display: 'flex', flexDirection: 'column', gap: 11.1,
        }}
      >
      {steps.length === 0 && (
        <div style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7 }}>{empty}</div>
      )}

      {steps.map((s) => {
        const newPhase = s.phase !== lastPhase;
        lastPhase = s.phase;
        return (
          <div key={s.id}>
            {newPhase && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9.6, margin: '7.2px 12px' }}>
                <span style={{ fontSize: 12.6, fontWeight: 700, letterSpacing: '.08em', color: 'var(--ink-3)' }}>
                  {PHASE_LABEL[s.phase].toUpperCase()}
                </span>
                <span style={{ flexGrow: 1, height: 1.2, background: 'var(--hair)' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9.6, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 13.2, color: 'var(--ink-3)' }}>{s.state}</span>
              <Badge executor={s.executor} />
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>+{(s.t / 1000).toFixed(0)}s</span>
            </div>
            <div style={{ fontSize: 16.2, fontWeight: 600, marginTop: 6 }}>{s.title}</div>
            {s.detail && (
              <div style={{ fontSize: 14.4, color: 'var(--ink-2)', marginTop: 4.8, lineHeight: 1.65 }}>{s.detail}</div>
            )}
            <Payload data={s.payload} />
            <div style={{ height: 16.8 }} />
          </div>
        );
      })}
      </div>
    </div>
  );
}
