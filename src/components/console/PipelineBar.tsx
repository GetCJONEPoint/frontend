import type { AgentId } from '../../lib/types';

/** 단계 그룹 색 — 탐지(파랑) / 분석(빨강, 빠르게 깜빡) / 마무리(초록) */
const STAGE_COLOR: Record<string, { c: string; fast: boolean; still?: boolean }> = {
  '탐지': { c: '#3987e5', fast: false },
  '트리아지': { c: '#d03b3b', fast: true },
  '전처리': { c: '#d03b3b', fast: true },
  '데이터 수집': { c: '#d03b3b', fast: true },
  '진단': { c: '#d03b3b', fast: true },
  '조치': { c: '#16a34a', fast: false },
  '쿨다운': { c: '#16a34a', fast: false },
  '종료': { c: '#16a34a', fast: false, still: true },   // 끝난 상태라 깜빡이지 않는다
};

/** 같은 이름이라도 에이전트마다 성격이 다른 단계는 여기서 덮어쓴다 */
const STAGE_OVERRIDE: Record<string, Record<string, { c: string; fast: boolean; still?: boolean }>> = {
  incident: {
    '데이터 수집': { c: '#3987e5', fast: false },
  },
};

function hexToRgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** 점선 한 벌 — 회색 바탕 위에 흰 점선이 진행률만큼 덮인다 */
const dashes = (color: string) =>
  `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 12px)`;

function Connector({ pct }: { pct: number }) {
  return (
    <span style={{ position: 'relative', flexGrow: 1, flexShrink: 0, minWidth: 18, height: 3, alignSelf: 'center' }}>
      <span style={{ position: 'absolute', inset: 0, background: dashes('var(--rule)') }} />
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100vw', background: dashes('var(--ink)') }} />
      </span>
    </span>
  );
}

function Check() {
  return (
    <span className="stage-check">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5 L9.5 18 L20 6.5" />
      </svg>
    </span>
  );
}

/** at = 그 단계가 끝나는 시각 */
export const LANES = [
  {
    key: 'quota' as const,
    short: 'Agent 1',
    name: '트래픽 기반 동적 자원 효율화',
    full: 'Agent 1 · 트래픽 기반 동적 자원 효율화 에이전트',
    stageWidth: 190,
    stages: [
      { label: '탐지', phase: 'detect' as const, at: 8_000 },
      { label: '트리아지', phase: 'triage' as const, at: 19_000 },
      { label: '진단', phase: 'diagnose' as const, at: 38_000 },
      { label: '조치', phase: 'act' as const, at: 48_000 },
      { label: '쿨다운', phase: 'cooldown' as const, at: 62_000 },
      { label: '종료', phase: 'done' as const, at: 76_000 },
    ],
  },
  {
    key: 'incident' as const,
    short: 'Agent 2',
    name: '이상 탐지 및 대응',
    full: 'Agent 2 · 이상 탐지 및 대응 에이전트',
    stageWidth: 190,
    stages: [
      { label: '탐지', phase: 'detect' as const, at: 8_000 },
      { label: '데이터 수집', phase: 'collect' as const, at: 14_400 }, // '프롬프트 제작'(t=12.4s) 노출 2초 뒤 다음 화면(진단)으로
      { label: '진단', phase: 'diagnose' as const, at: 34_500 }, // '검증'(t=27.5s) 도 앞의 두 단계와 같은 7초씩 노출된 뒤 다음 화면(조치)으로
      { label: '조치', phase: 'act' as const, at: 62_500 },
      { label: '쿨다운', phase: 'cooldown' as const, at: 72_500 },
      { label: '종료', phase: 'done' as const, at: 77_000 },
    ],
  },
];

/** 지금 어느 단계인가 — 왼쪽 슬롯과 오른쪽 카드가 이걸 따라간다 */
export function stageAt(key: AgentId, t: number) {
  const lane = LANES.find((l) => l.key === key)!;
  return lane.stages.find((st) => t < st.at) ?? lane.stages[lane.stages.length - 1];
}

export default function PipelineBar({ t, selected }: {
  t: number;
  selected: AgentId;
}) {
  const lane = LANES.find((l) => l.key === selected)!;

  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {lane.stages.map((st, i) => {
          const done = t >= st.at;
          // 첫 단계는 시작부터 진행 중이다 — 탐지는 알람을 기다리는 상태 그 자체다
          const active = !done && t >= (lane.stages[i - 1]?.at ?? 0);
          // 커넥터는 '앞 단계가 도는 동안' 그 단계에서 이쪽으로 뻗어 온다.
          // 앞 단계가 깜빡이기 시작할 때 0%, 그 단계가 끝나는 순간 100%.
          const prevAt = lane.stages[i - 1]?.at ?? 0;
          const prevFrom = lane.stages[i - 2]?.at ?? 0;
          const fillPct = i === 0 ? 0
            : Math.max(0, Math.min(1, (t - prevFrom) / (prevAt - prevFrom))) * 100;
          const { c, fast, still } = STAGE_OVERRIDE[lane.key]?.[st.label] ?? STAGE_COLOR[st.label] ?? { c: '#3987e5', fast: false, still: false };
          return (
            <div key={st.label} style={{ display: 'contents' }}>
              {i > 0 && <Connector pct={fillPct} />}
              <div
                className="stage"
                data-state={done ? 'done' : active ? 'active' : 'todo'}
                data-fast={fast ? 'true' : undefined}
                data-still={still ? 'true' : undefined}
                style={{
                  flexBasis: lane.stageWidth,
                  ['--stage-c' as string]: c,
                  ['--stage-bg' as string]: hexToRgba(c, 0.45),
                  ['--stage-ring' as string]: hexToRgba(c, 0.7),
                }}
              >
                {st.label}
                {(done || (active && still)) && <Check />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 헤더에 붙는 다크모드형 2단 스위치 */
export function AgentSwitch({ value, onChange }: { value: AgentId; onChange: (a: AgentId) => void }) {
  return (
    <div
      style={{
        position: 'relative', display: 'flex', flexShrink: 0,
        background: 'var(--surface-2)', border: '1px solid var(--line)',
        borderRadius: 999, padding: 3,
      }}
    >
      {/* 움직이는 손잡이 */}
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, bottom: 3, width: 'calc(50% - 3px)',
          left: value === 'quota' ? 3 : 'calc(50%)',
          background: 'var(--accent)', borderRadius: 999,
          transition: 'left .18s cubic-bezier(.4,0,.2,1)',
        }}
      />
      {LANES.map((l) => (
        <button
          key={l.key}
          onClick={() => onChange(l.key)}
          style={{
            position: 'relative', zIndex: 1, width: 86, padding: '5px 0',
            fontSize: 12, fontWeight: 700, borderRadius: 999,
            color: value === l.key ? '#0d0d0d' : 'var(--ink-3)',
            transition: 'color .18s',
          }}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
