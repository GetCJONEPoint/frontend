import type { AgentId, AgentStep } from '../../lib/types';

const LANES = [
  {
    key: 'quota' as const,
    name: 'Agent 1 · 쿼터 재분배',
    trigger: '트리거 — 사용률 80% 초과 지속',
    stages: [
      { label: '투영 · 조달', at: 19_000 },
      { label: '조합 선택', at: 32_000 },
      { label: '검증 · 집행', at: 48_000 },
      { label: '이력', at: 76_000 },
    ],
  },
  {
    key: 'incident' as const,
    name: 'Agent 2 · 장애 대응',
    trigger: '트리거 — 이상탐지 알람',
    stages: [
      { label: '전처리', at: 50_000 },
      { label: '진단 · 검증', at: 70_000 },
      { label: '조치 · 실행', at: 112_000 },
      { label: '이력', at: 132_000 },
    ],
  },
];

export default function PipelineBar({
  t, steps, selected, onSelect,
}: {
  t: number;
  steps: AgentStep[];
  selected: AgentId | 'both';
  onSelect: (a: AgentId | 'both') => void;
}) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', gap: 12, padding: '12px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
      {LANES.map((lane) => {
        const started = steps.some((s) => s.agent === lane.key);
        const solo = selected === lane.key;
        const dimmed = selected !== 'both' && !solo;
        return (
          <button
            key={lane.key}
            onClick={() => onSelect(solo ? 'both' : lane.key)}
            title={solo ? '클릭하면 두 에이전트를 다시 나란히 봅니다' : '클릭하면 이 에이전트만 크게 봅니다'}
            style={{
              flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 14, minWidth: 0, cursor: 'pointer', padding: '9px 12px', borderRadius: 10,
              background: solo ? 'rgba(255,255,255,.05)' : 'transparent',
              border: solo ? '1px solid var(--line)' : '1px solid transparent',
              opacity: dimmed ? 0.4 : 1,
              transition: 'opacity .15s, background .15s, border-color .15s',
            }}
          >
            <div style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', color: started ? 'var(--ink)' : 'var(--ink-3)' }}>
              {lane.name}
            </div>
            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 0, maxWidth: 560 }}>
              {lane.stages.map((st, i) => {
                const done = t >= st.at;
                const active = !done && t >= (lane.stages[i - 1]?.at ?? 0) && started;
                return (
                  <div key={st.label} style={{ display: 'contents' }}>
                    {i > 0 && <span style={{ width: 10, height: 1, background: 'var(--rule)', flexShrink: 0 }} />}
                    <div
                      style={{
                        flexGrow: 1, textAlign: 'center', padding: '7px 4px', borderRadius: 8, fontSize: 11.5,
                        fontWeight: done || active ? 700 : 500,
                        color: done ? 'var(--ink)' : active ? 'var(--ink)' : 'var(--ink-3)',
                        background: active ? 'rgba(57,135,229,.14)' : done ? 'var(--surface)' : 'transparent',
                        border: active ? '1px solid var(--t-cgv)' : '1px solid var(--line)',
                      }}
                    >
                      {st.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
