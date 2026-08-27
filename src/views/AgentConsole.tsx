import { useEffect, useState } from 'react';
import PipelineBar, { AgentSwitch, LANES, stageAt } from '../components/console/PipelineBar';
import ObservePanel from '../components/console/ObservePanel';
import AgentLane from '../components/console/AgentLane';
import ReplayBar from '../components/console/ReplayBar';
import ComboPopup from '../components/console/ComboPopup';
import HitlPopup from '../components/console/HitlPopup';
import { RATE_PER_M, loadRuns } from '../lib/mockRun';
import { TENANTS } from '../lib/tenants';
import { useReplay } from '../lib/useReplay';
import { useBus } from '../lib/bus';
import type { AgentId, RunTimeline } from '../lib/types';

const FALLBACK_DURATION = 140_000;

export default function AgentConsole() {
  const [runs, setRuns] = useState<{ quota: RunTimeline; incident: RunTimeline } | null>(null);
  const [loadBanner, setLoadBanner] = useState<string | null>(null);
  const [focus, setFocus] = useState<AgentId>('quota');
  const [comboClosed, setComboClosed] = useState(false);
  const [hitlClosed, setHitlClosed] = useState(false);

  // 두 에이전트는 서로 다른 상황이라 시계도 따로 돈다
  const q = useReplay(runs?.quota.durationMs ?? FALLBACK_DURATION);
  const i = useReplay(runs?.incident.durationMs ?? FALLBACK_DURATION);

  useEffect(() => {
    document.title = 'AIOps 에이전트 콘솔';
    let alive = true;
    loadRuns().then((r) => { if (alive) setRuns(r); });
    return () => { alive = false; };
  }, []);

  // 진단 종료(q-verify) 시점에 팝업 · 배지 · 쿼터 조정이 한꺼번에 뜬다
  const comboReached = focus === 'quota' && !!runs && runs.quota.steps.some((s) => s.id === 'q-verify' && s.t <= q.t);
  useEffect(() => { if (!comboReached) setComboClosed(false); }, [comboReached]);

  // Agent 2 는 HITL(Slack 승인) 순간에 알림이 뜬다
  const hitlReached = focus === 'incident' && !!runs && runs.incident.steps.some((s) => s.id === 'i-hitl' && s.t <= i.t);
  useEffect(() => { if (!hitlReached) setHitlClosed(false); }, [hitlReached]);
  // 팝업이 사라지면 승인 대기 없이 곧장 다음 단계(집행)로 넘어간다

  const clock = focus === 'quota' ? q : i;
  const { t, playing, speed, setSpeed, toggle, seek, play } = clock;
  const run = focus === 'quota' ? runs?.quota : runs?.incident;

  useBus((msg) => {
    if (msg.type === 'load') {
      setLoadBanner(msg.on ? `${msg.tenant} 부하 주입 중 · 목표 ${msg.rps.toLocaleString('ko-KR')} QPS` : null);
      if (msg.on) play();
    }
    if (msg.type === 'replay') {
      if (msg.action === 'seek' && typeof msg.t === 'number') seek(msg.t);
      else toggle();
    }
  });

  if (!runs || !run) {
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

  // 지금 어느 단계인가 — 왼쪽 슬롯과 오른쪽 카드가 이걸 따라간다
  const stage = stageAt(focus, t);
  const laneSteps = (focus === 'quota' ? quotaSteps : incidentSteps).filter((s) => s.phase === stage.phase);

  // 진단이 끝나는 순간 팝업 · 경고 배지 · 쿼터 조정이 한꺼번에 뜬다
  const verified = quotaSteps.some((s) => s.id === 'q-verify');
  const decideStep = quotaSteps.find((s) => s.id === 'q-decide');
  const picked = (decideStep?.payload as { options?: { name: string; verdict: string; note: string }[] } | undefined)
    ?.options?.find((o) => o.verdict === '채택');
  const short = run.projection.needRps - run.projection.poolFreeRps;
  const rebalanceNote = verified
    ? `파이 조달 불가 · 부족 ${short.toLocaleString('ko-KR')} rps → ${TENANTS[run.projection.tenant].label} 전용 노드풀 격리`
    : undefined;

  // 단계가 바뀌어도 남는 것 — 지금까지 확정된 사실
  const has = (id: string) => run.steps.some((s) => s.id === id && s.t <= t);
  const at = (id: string) => run.steps.find((s) => s.id === id)?.t ?? 0;
  const cell = (id: string, label: string, value: string) => ({
    label, value: has(id) ? value : '—',
    state: (!has(id) ? 'todo' : t - at(id) < 6_000 ? 'now' : 'done') as 'done' | 'now' | 'todo',
  });
  const chain = focus === 'quota'
    ? [
        cell('q-trigger', '트리거', '2,880 / 3,600 = 80.0%'),
        cell('q-need', '필요량', '+2,000 rps · 30분 지평'),
        cell('q-pool', '조달 가능', '870 rps · 부족 1,130'),
        cell('q-decide', '결정', '전용 노드풀 격리 (Karpenter)'),
        cell('q-apply', '집행', '쿼터 3,600 → 5,600 · 노드 +12'),
        cell('q-record', '종료', '이력 저장 · 회수 조건 감시'),
      ]
    : [
        cell('i-sqs', '알람', '온스타일 적립 P99 베이스라인 이탈'),
        cell('i-collect', '수집', '방송 시작 이벤트 · ERROR 612건'),
        cell('i-json', '진단', '공용 RDS Proxy 풀 97% 점유 · 복합 원인'),
        cell('i-verify', '신뢰도', '0.78 · 도구 3회 · 3종'),
        cell('i-exec', '집행', 'RB-04 → RB-05 → RB-01 · T2 승인'),
        cell('i-watch', '종료', 'M1 · M2 도달 · P99 620ms'),
      ];
  // Agent 2 HITL 알림에 쓸 조치안
  const planStep = run.steps.find((s) => s.id === 'i-plan');
  const planPayload = planStep?.payload as { plan?: { id: string; name: string; param?: string }[]; expected?: string; monitorSec?: number } | undefined;

  // 검증 5개 항목은 한순간에 몰아서 뜨지 않는다 — q-decide → q-verify 구간에서 하나씩 통과해간다
  const VERIFY_TOTAL = 5;
  const verifyStartAt = at('q-decide');
  const verifyEndAt = at('q-verify');
  const verifyPassed = verifyEndAt > verifyStartAt
    ? Math.max(0, Math.min(VERIFY_TOTAL, Math.floor(((t - verifyStartAt) / (verifyEndAt - verifyStartAt)) * VERIFY_TOTAL)))
    : 0;
  const quotaVerdict = verifyStartAt > 0 && t >= verifyStartAt
    ? (verifyPassed >= VERIFY_TOTAL ? `검증 ${VERIFY_TOTAL}/${VERIFY_TOTAL} 통과 · LLM 폴백 없음` : `검증 ${verifyPassed}/${VERIFY_TOTAL}`)
    : undefined;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{LANES.find((l) => l.key === focus)?.full}</span>
        <span style={{ flexGrow: 1 }} />
        {loadBanner && <span className="chip chip-crit pulse">{loadBanner}</span>}
        <AgentSwitch value={focus} onChange={setFocus} />
      </div>

      <PipelineBar t={t} selected={focus} />

      <div style={{ flexGrow: 1, display: 'flex', gap: 16, padding: '16px 20px', minHeight: 0 }}>
        <ObservePanel
          samples={run.samples}
          idx={idx}
          sloMs={run.sloMs}
          tenantTotal={run.tenantTotal}
          agent={focus}
          phase={stage.phase}
          t={t}
          durationMs={run.durationMs}
          projection={run.projection}
          usage={usage}
          rebalanceNote={rebalanceNote}
        />
        <div style={{ flex: '6 1 0', minWidth: 0, display: 'flex', gap: 14, minHeight: 0 }}>
          <AgentLane
            title={focus === 'quota' ? 'Agent 1 — 트래픽 기반 동적 자원 효율화' : 'Agent 2 — 이상 탐지 및 대응'}
            subtitle={focus === 'quota' ? '예방적 · 트리거 쿼터 80%' : '사후적 · 트리거 이상탐지 알람'}
            steps={laneSteps}
            t={t}
            chain={chain}
            verdict={
              focus === 'quota'
                ? quotaVerdict
                : (incidentSteps.some((s) => s.id === 'i-verify') ? '신뢰도 0.78 · 도구 3회 · 3종' : undefined)
            }
            empty={focus === 'quota' ? '쿼터 80% 트리거를 기다리는 중입니다' : '이상탐지 알람을 기다리는 중입니다'}
          />
        </div>
      </div>

      {comboReached && !comboClosed && picked && (
        <ComboPopup
          tenant={run.projection.tenant}
          action="전용 노드풀 격리"
          sub={`파이 안에서는 조달 불가 — 도너 3곳 합산 ${run.projection.poolFreeRps.toLocaleString('ko-KR')} rps < 필요 ${run.projection.needRps.toLocaleString('ko-KR')} rps`}
          shortfall={short}
          quotaFrom={run.projection.quota}
          quotaTo={run.projection.quota + run.projection.needRps}
          reason={picked.note}
          onClose={() => setComboClosed(true)}
        />
      )}

      {hitlReached && !hitlClosed && planPayload?.plan && (
        <HitlPopup
          tenant={run.projection.tenant}
          tier="T2"
          symptom="공용 RDS Proxy 풀 소진 · CJ 온스타일 적립 P99 2.4s"
          plan={planPayload.plan}
          expected={planPayload.expected}
          timeoutSec={planPayload.monitorSec ?? 600}
          approver="@yuhyun 승인 · 55초"
          onClose={() => setHitlClosed(true)}
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
