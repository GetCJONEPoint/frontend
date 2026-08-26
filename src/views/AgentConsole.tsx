import { useEffect, useState } from 'react';
import PipelineBar, { AgentSwitch } from '../components/console/PipelineBar';
import ObservePanel from '../components/console/ObservePanel';
import AgentLane from '../components/console/AgentLane';
import ReplayBar from '../components/console/ReplayBar';
import ComboPopup from '../components/console/ComboPopup';
import { RATE_PER_M, loadRun } from '../lib/mockRun';
import { TENANTS } from '../lib/tenants';
import { useReplay } from '../lib/useReplay';
import { useBus } from '../lib/bus';
import type { AgentId, PosCall, RunTimeline } from '../lib/types';

const FALLBACK_DURATION = 140_000;

export default function AgentConsole() {
  const [run, setRun] = useState<RunTimeline | null>(null);
  const [posCalls, setPosCalls] = useState<PosCall[]>([]);
  const [loadBanner, setLoadBanner] = useState<string | null>(null);
  const [focus, setFocus] = useState<AgentId>('quota');
  const [comboClosed, setComboClosed] = useState(false);

  const { t, playing, speed, setSpeed, toggle, seek, play } = useReplay(run?.durationMs ?? FALLBACK_DURATION);

  useEffect(() => {
    document.title = 'AIOps 에이전트 콘솔';
    let alive = true;
    loadRun().then((r) => { if (alive) setRun(r); });
    return () => { alive = false; };
  }, []);

  const comboReached = !!run && run.steps.some((s) => s.id === 'q-combo' && s.t <= t);
  useEffect(() => { if (!comboReached) setComboClosed(false); }, [comboReached]);

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

  // 조합 선택이 끝나면 어떤 도너에서 얼마를 가져왔는지 관측 패널에도 띄운다
  const comboStep = quotaSteps.find((s) => s.id === 'q-combo');
  const chosen = (comboStep?.payload as { combos?: { label: string; total: number; chosen: boolean; reason: string }[] } | undefined)
    ?.combos?.find((c) => c.chosen);
  const chosenCombo = chosen?.label;
  const donorKeys = (comboStep?.payload as { donorKeys?: string[] } | undefined)?.donorKeys ?? [];
  const rebalanceNote = chosenCombo ? `${chosenCombo} → ${TENANTS[run.projection.tenant].label} 할당` : undefined;
  const incidentSteps = visible.filter((s) => s.agent === 'incident');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>AIOps 에이전트 실행 콘솔</span>
        <span style={{ flexGrow: 1 }} />
        {loadBanner && <span className="chip chip-crit pulse">{loadBanner}</span>}
        <AgentSwitch value={focus} onChange={setFocus} />
      </div>

      <PipelineBar t={t} steps={visible} selected={focus} />

      <div style={{ flexGrow: 1, display: 'flex', gap: 16, padding: '16px 20px', minHeight: 0 }}>
        <ObservePanel
          samples={run.samples}
          idx={idx}
          sloMs={run.sloMs}
          posCalls={posCalls}
          tenantTotal={run.tenantTotal}
          usage={usage}
          rebalanceNote={rebalanceNote}
          donors={donorKeys}
        />
        <div style={{ flex: '6 1 0', minWidth: 0, display: 'flex', gap: 14, minHeight: 0 }}>
        {focus === 'quota' && (
          <AgentLane
            title="Agent 1 — 트래픽 기반 동적 자원 효율화"
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
        {focus === 'incident' && (
          <AgentLane
            title="Agent 2 — 이상 탐지 및 대응"
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

      {comboReached && !comboClosed && chosen && (
        <ComboPopup
          label={chosen.label}
          reason={chosen.reason}
          total={chosen.total}
          toTenant={run.projection.tenant}
          quotaFrom={run.projection.quota}
          quotaTo={run.projection.quota + run.projection.needRps}
          onClose={() => setComboClosed(true)}
        />
      )}

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
