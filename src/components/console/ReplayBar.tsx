import type { AgentStep } from '../../lib/types';

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  t: number;
  duration: number;
  playing: boolean;
  speed: number;
  events: AgentStep[];
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onSpeed: (v: number) => void;
}

export default function ReplayBar({ t, duration, playing, speed, events, onToggle, onSeek, onSpeed }: Props) {
  return (
    <div
      style={{
        height: 74, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--line)',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: 40, height: 40, borderRadius: 10, background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
        aria-label={playing ? '일시정지' : '재생'}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0d0d0d"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0d0d0d"><path d="M8 5.5v13l11-6.5z" /></svg>
        )}
      </button>

      <span className="mono" style={{ fontSize: 14, fontWeight: 600, width: 96, flexShrink: 0 }}>
        {fmt(t)} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>/ {fmt(duration)}</span>
      </span>

      <div style={{ flexGrow: 1, position: 'relative', height: 40, display: 'flex', alignItems: 'center' }}>
        {/* 이벤트 마커 — 진행자가 "여기가 판단 시점" 하고 바로 집을 수 있게 */}
        {events.map((e) => (
          <button
            key={e.id}
            title={`${fmt(e.t)} · ${e.title}`}
            onClick={() => onSeek(e.t)}
            style={{
              position: 'absolute', left: `${(e.t / duration) * 100}%`,
              width: 3, height: 16, marginLeft: -1, borderRadius: 2,
              background: e.agent === 'quota' ? 'var(--t-oliveyoung)' : 'var(--accent)',
              transform: 'translateY(-11px)',
            }}
          />
        ))}
        <input
          type="range" min={0} max={duration} step={100} value={Math.round(t)}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {[0.5, 1, 2, 3, 4].map((v) => (
          <button
            key={v}
            onClick={() => onSpeed(v)}
            className="mono"
            style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: speed === v ? 'var(--accent)' : 'var(--hair)',
              color: speed === v ? '#0d0d0d' : 'var(--ink-2)',
            }}
          >
            {v}×
          </button>
        ))}
      </div>
    </div>
  );
}
