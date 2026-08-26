import { useEffect, useState } from 'react';
import PipelineBar from '../components/console/PipelineBar';
import ObservePanel from '../components/console/ObservePanel';
import AgentLane from '../components/console/AgentLane';
import ReplayBar from '../components/console/ReplayBar';
import { RATE_PER_M, loadRun } from '../lib/mockRun';
import { useReplay } from '../lib/useReplay';
import { useBus } from '../lib/bus';
import type { AgentId, PosCall, RunTimeline } from '../lib/types';

const FALLBACK_DURATION = 140_000;

export default function AgentConsole() {
  const [run, setRun] = useState<RunTimeline | null>(null);
  const [posCalls, setPosCalls] = useState<PosCall[]>([]);
  const [loadBanner, setLoadBanner] = useState<string | null>(null);
  const [showCaveats, setShowCaveats] = useState(false);
  const [focus, setFocus] = useState<AgentId | 'both'>('quota');

  const { t, playing, speed, setSpeed, toggle, seek, play } = useReplay(run?.durationMs ?? FALLBACK_DURATION);

  useEffect(() => {
    document.title = 'AIOps 에이전트 콘솔';
    let alive = true;
    loadRun().then((r) => { if (alive) setRun(r); });
    return () => { alive = false; };
  }, []);

  useBus((msg) => {
    if (msg.type === 'pos-call') setPosCalls((prev) => [msg.call, ...prev].slice(0, 8));
    if (msg.type === 'load') {
      setLoadBanner(msg.on ? `${msg.tenant} 부하 주입 중 · 목표 ${msg.rps.toLocaleString('ko-KR')} QPS` : null);
      if (msg.on) play();
    }
    if (msg.type === 'replay') {
      if (msg.action === 'seek' && typeof msg.t === 'number') seek(msg.t);
      else toggle();
    }
  });

  if (!run) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
        run 불러오는 중…
      </div>
    );
  }

  const idx = Math.max(0, Math.min(Math.floor(t / 1000) || 0, run.samples.length - 1));
  const visible = run.steps.filter((s) => s.t <= t);
  const llm = visible.filter((s) => s.tokens);
  const inTok = llm.reduce((a, s) => a + (s.tokens?.in ?? 0), 0);
  const outTok = llm.reduce((a, s) => a + (s.tokens?.out ?? 0), 0);
  const usage = {
    inTok, outTok, calls: llm.length,
    costUsd: (inTok / 1e6) * RATE_PER_M.in + (outTok / 1e6) * RATE_PER_M.out,
  };

  const quotaSteps = visible.filter((s) => s.agent === 'quota');
  const incidentSteps = visible.filter((s) => s.agent === 'incident');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>AIOps 에이전트 실행 콘솔</span>
        <span style={{ flexGrow: 1 }} />
        {loadBanner && <span className="chip chip-crit pulse">{loadBanner}</span>}
        <button
          onClick={() => setShowCaveats((v) => !v)}
          className="chip chip-warn"
          style={{ cursor: 'pointer' }}
          title="이 화면에서 아직 구현되지 않은 것"
        >
          미구현 {run.caveats.length}건
        </button>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>레인 클릭 → 단독 보기</span>
        <span className="chip chip-good">리플레이 · 실시간 아님</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>run_id={run.runId}</span>
      </div>

      {showCaveats && (
        <div style={{ flexShrink: 0, background: 'rgba(250,178,25,.08)', borderBottom: '1px solid rgba(250,178,25,.3)', padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {run.caveats.map((c) => (
            <div key={c} style={{ fontSize: 12, color: 'var(--ink-2)' }}>· {c}</div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            숨기지 않고 먼저 밝히는 편이 낫습니다. 질문받고 인정하는 것보다.
          </div>
        </div>
      )}

      <PipelineBar t={t} steps={visible} selected={focus} onSelect={setFocus} />

      <div style={{ flexGrow: 1, display: 'flex', gap: 16, padding: '16px 20px', minHeight: 0 }}>
        <ObservePanel
          samples={run.samples}
          idx={idx}
          sloMs={run.sloMs}
          projection={run.projection}
          posCalls={posCalls}
          tenantTotal={run.tenantTotal}
          usage={usage}
        />
        <div style={{ flex: '6 1 0', minWidth: 0, display: 'flex', gap: 14, minHeight: 0 }}>
        {focus !== 'incident' && (
          <AgentLane
            title="Agent 1 — 쿼터 재분배"
            subtitle="예방적 · 트리거 쿼터 80%"
            steps={quotaSteps}
            verdict={
              quotaSteps.some((s) => s.id === 'q-verify')
                ? '검증 5/5 통과 · LLM 폴백 없음'
                : undefined
            }
            empty="쿼터 80% 트리거를 기다리는 중입니다."
          />
        )}
        {focus !== 'quota' && (
          <AgentLane
            title="Agent 2 — 장애 대응"
            subtitle="사후적 · 트리거 이상탐지 알람"
            steps={incidentSteps}
            verdict={
              incidentSteps.some((s) => s.id === 'i-verify')
                ? '신뢰도 0.82 · 도구 7회 · 5종'
                : undefined
            }
            empty="이상탐지 알람이 오면 깨어납니다. SQS incident-alerts → 전처리 Lambda."
          />
        )}
        </div>
      </div>

      <ReplayBar
        t={t}
        duration={run.durationMs}
        playing={playing}
        speed={speed}
        events={run.steps}
        onToggle={toggle}
        onSeek={seek}
        onSpeed={setSpeed}
      />
    </div>
  );
}
