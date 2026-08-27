import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import { BUSINESS_EVENTS, FORECAST } from '../../lib/mockRun';
import type { AgentId, Phase, Projection, TenantKey, TenantSample } from '../../lib/types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding: '11px 15.7px', display: 'flex', flexDirection: 'column', gap: 8, ...extra,
});
const Title = ({ t, sub }: { t: string; sub?: string }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexShrink: 0, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 15.7, fontWeight: 600 }}>{t}</span>
    {sub && <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>{sub}</span>}
  </div>
);

/* ── 공통 · 줄 목록 ───────────────────────────── */
export interface Line { k: string; v: string; tone?: 'warn' | 'crit' | 'good' | 'dim' }
const TONE: Record<string, string> = { warn: 'var(--warn)', crit: '#d03b3b', good: '#16a34a', dim: 'var(--ink-3)' };

function LinesCard({ title, sub, lines, grow = true }: { title: string; sub?: string; lines: Line[]; grow?: boolean }) {
  return (
    <div className="card" style={card(grow ? { flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start' } : { flexGrow: 0, flexShrink: 0 })}>
      <Title t={title} sub={sub} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0 }}>
        {lines.map((l) => (
          <div key={l.k} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ width: 118, flexShrink: 0, fontSize: 13, color: 'var(--ink-3)' }}>{l.k}</span>
            <span
              className="mono"
              style={{ fontSize: 14, color: l.tone ? TONE[l.tone] : 'var(--ink)', fontWeight: l.tone && l.tone !== 'dim' ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {l.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 탐지 · 트리거 게이지 ─────────────────────── */
function GaugeCard({ sample, tenant }: { sample: TenantSample; tenant: 'oliveyoung' }) {
  const now = sample.qps[tenant];
  const lim = sample.quotaLimit[tenant];
  const pct = clamp01(now / lim) * 100;
  const meta = TENANTS[tenant];
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 12 })}>
      <Title t="트리거 감시" sub="사용률 80% 2분 지속" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: meta.color, fontWeight: 700 }}>{meta.label}</span>
        <span className="mono" style={{ fontSize: 34, fontWeight: 700, color: pct >= 80 ? '#d03b3b' : 'var(--ink)' }}>
          {Math.round(pct * 10) / 10}%
        </span>
        <span className="mono" style={{ fontSize: 15, color: 'var(--ink-3)' }}>
          {now.toLocaleString('ko-KR')} / {lim.toLocaleString('ko-KR')} rps
        </span>
      </div>
      <div className="bar-track" style={{ height: 20, position: 'relative' }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: pct >= 80 ? '#d03b3b' : meta.color }} />
        <span style={{ position: 'absolute', left: '80%', top: -5, width: 2.5, height: 30, background: '#d03b3b' }} />
      </div>
      <span style={{ fontSize: 12.4, color: 'var(--ink-3)' }}>
        배송 완료 시각이 불규칙해 사전 예측이 안 된다 — 관측 축과 비즈니스 축을 함께 본다
      </span>
    </div>
  );
}

/* ── 트리아지 · 비즈니스 스케줄 ───────────────── */
function ScheduleCard() {
  return (
    <div className="card" style={card({ flexShrink: 0, padding: '8px 15.7px', gap: 5 })}>
      <span style={{ fontSize: 15.7, fontWeight: 600 }}>비즈니스 스케줄 이력</span>
      <div style={{ display: 'flex', gap: 14, minWidth: 0 }}>
        {BUSINESS_EVENTS.map((col, ci) => (
          <div key={col.title} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3.5, paddingLeft: ci ? 14 : 0, borderLeft: ci ? '1px solid var(--hair)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 12.6, fontWeight: 700, color: ci ? 'var(--ink)' : 'var(--ink-3)' }}>{col.title}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.sub}</span>
            </div>
            {col.rows.map((r) => (
              <div key={r.when} style={{ display: 'flex', flexDirection: 'column', opacity: r.dim ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span className="mono" style={{ fontSize: 11.8, color: r.hot ? 'var(--warn)' : 'var(--ink-3)', fontWeight: r.hot ? 700 : 400, whiteSpace: 'nowrap' }}>{r.when}</span>
                  <span style={{ fontSize: 13.4, color: r.hot ? 'var(--ink)' : ci ? 'var(--ink-2)' : 'var(--ink-3)', fontWeight: r.hot ? 700 : 400, whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ flexGrow: 1 }} />
                  {r.tag && (
                    <span className="chip" style={{ flexShrink: 0, fontSize: 10.5, background: r.hot ? 'rgba(250,178,25,.16)' : 'rgba(255,255,255,.06)', color: r.hot ? 'var(--warn)' : 'var(--ink-3)' }}>{r.tag}</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 트리아지 · 30분 지평 투영 ────────────────── */
function ForecastCard({ t }: { t: number }) {
  const { horizonMin, threshold, yMax, series, drawFrom, drawTo } = FORECAST;
  const W = 560, H = 300;
  const y = (v: number) => H - (Math.min(v, yMax) / yMax) * H;
  const drawn = clamp01((t - drawFrom) / (drawTo - drawFrom));
  const pts = (from: number, to: number) => {
    const out: string[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) * drawn;
      out.push(`${(u * W).toFixed(1)},${y(from + (to - from) * u).toFixed(1)}`);
    }
    return out.join(' ');
  };
  const lead = series[0];
  const leadNow = lead.from + (lead.to - lead.from) * drawn;
  const crossU = clamp01((threshold - lead.from) / (lead.to - lead.from));

  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 72, padding: '10px 15.7px', gap: 5 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 15.7, fontWeight: 600 }}>예상 추이</span>
        <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>테넌트별 {horizonMin}분 뒤 예상 트래픽</span>
        <span style={{ flexGrow: 1 }} />
        {series.map((sr) => (
          <span key={sr.tenant} style={{ display: 'inline-flex', alignItems: 'center', gap: 4.6 }}>
            <span style={{ width: 11, height: 3, borderRadius: 2, background: TENANTS[sr.tenant].color }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{TENANTS[sr.tenant].label}</span>
          </span>
        ))}
      </div>
      <div style={{ flexGrow: 1, minHeight: 0, position: 'relative', paddingRight: 62 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="30분 지평 트래픽 투영">
          <line x1="0" y1="0" x2="0" y2={H} stroke="var(--rule)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={H} x2={W} y2={H} stroke="var(--rule)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={y(threshold)} x2={W} y2={y(threshold)} stroke="#d03b3b" strokeWidth="1.8" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          {drawn >= crossU && (
            <line x1={crossU * W} y1={y(threshold)} x2={crossU * W} y2={H} stroke="#d03b3b" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" vectorEffect="non-scaling-stroke" />
          )}
          {series.map((sr) => (
            <polyline key={sr.tenant} fill="none" stroke={TENANTS[sr.tenant].color} strokeWidth={sr === lead ? 2.8 : 1.9} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={pts(sr.from, sr.to)} />
          ))}
        </svg>
        <span style={{ position: 'absolute', right: 0, top: `${(1 - threshold / yMax) * 100}%`, transform: 'translateY(-50%)', fontSize: 11.5, color: '#d03b3b', fontWeight: 700, whiteSpace: 'nowrap' }}>
          임계점 {threshold.toLocaleString('ko-KR')}
        </span>
        {drawn > 0.02 && (
          <span className="mono" style={{ position: 'absolute', left: `calc(${drawn * 100}% - ${drawn * 62}px)`, top: `${(1 - Math.min(leadNow, yMax) / yMax) * 100}%`, transform: 'translate(6px, -50%)', fontSize: 12.5, fontWeight: 700, color: TENANTS[lead.tenant].color, whiteSpace: 'nowrap' }}>
            {Math.round(leadNow).toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexShrink: 0, fontSize: 11.5, color: 'var(--ink-3)', paddingRight: 62 }}>
        <span>지금</span><span style={{ flexGrow: 1 }} /><span>+{Math.round(horizonMin / 2)}분</span><span style={{ flexGrow: 1 }} /><span>+{horizonMin}분</span>
      </div>
    </div>
  );
}

/* ── 진단 · 조달 격차 ─────────────────────────── */
function GapCard({ projection }: { projection: Projection }) {
  const need = projection.needRps;
  const pool = projection.poolFreeRps;
  const donors = [
    { k: 'cgv' as const, v: 300 },
    { k: 'cjenm' as const, v: 150 },
    { k: 'vips' as const, v: 420 },
  ];
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 11 })}>
      <Title t="조달 격차" sub="도너를 다 합쳐도 모자란다" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 74, flexShrink: 0, fontSize: 13, color: 'var(--ink-3)' }}>필요량</span>
          <div className="bar-track" style={{ flexGrow: 1, height: 18 }}>
            <div className="bar-fill" style={{ width: '100%', background: '#d03b3b' }} />
          </div>
          <span className="mono" style={{ width: 84, textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#d03b3b' }}>{need.toLocaleString('ko-KR')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 74, flexShrink: 0, fontSize: 13, color: 'var(--ink-3)' }}>조달 가능</span>
          <div className="bar-track" style={{ flexGrow: 1, height: 18, display: 'flex' }}>
            {donors.map((d) => (
              <div key={d.k} title={TENANTS[d.k].label} style={{ width: `${(d.v / need) * 100}%`, height: '100%', background: TENANTS[d.k].color }} />
            ))}
          </div>
          <span className="mono" style={{ width: 84, textAlign: 'right', fontSize: 15, fontWeight: 700 }}>{pool.toLocaleString('ko-KR')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {donors.map((d) => (
          <span key={d.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: TENANTS[d.k].color }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{TENANTS[d.k].label} {d.v}</span>
          </span>
        ))}
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: '#d03b3b' }}>부족 {(need - pool).toLocaleString('ko-KR')} rps</span>
      </div>
    </div>
  );
}

/* ── 조치 · 집행 전후 ─────────────────────────── */
function BeforeAfterCard({ projection }: { projection: Projection }) {
  const to = TENANTS[projection.tenant];
  const after = projection.quota + projection.needRps;
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 11 })}>
      <Title t="집행 — 전용 노드풀 격리" sub="파이를 키운다 · 남의 것을 뺏지 않는다" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: to.color, fontWeight: 700 }}>{to.label} 쿼터</span>
        <span className="mono" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontSize: 30, fontWeight: 700 }}>
          <span style={{ color: 'var(--ink-3)' }}>{projection.quota.toLocaleString('ko-KR')}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 22 }}>→</span>
          <span style={{ color: to.color }}>{after.toLocaleString('ko-KR')}</span>
        </span>
        <span style={{ flexGrow: 1 }} />
        <span className="chip" style={{ background: 'rgba(22,163,74,.16)', color: '#16a34a', fontSize: 13, padding: '4px 11px' }}>+{projection.needRps.toLocaleString('ko-KR')} rps</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {TENANT_ORDER.filter((k) => k !== projection.tenant).map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: TENANTS[k].color, flexShrink: 0 }} />
            <span style={{ width: 100, fontSize: 13, color: 'var(--ink-2)' }}>{TENANTS[k].label}</span>
            <span className="mono" style={{ fontSize: 13.4, color: 'var(--ink-3)' }}>변동 없음</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 종료 · run 요약 ──────────────────────────── */
function SummaryCard({ agent, usage, durationMs }: { agent: AgentId; usage: { inTok: number; outTok: number; calls: number; costUsd: number }; durationMs: number }) {
  const decision = agent === 'quota'
    ? '전용 노드풀 격리 · 쿼터 3,600 → 5,600'
    : 'RB-04 + RB-05 + RB-01 · P99 2.4s → 620ms';
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 10 })}>
      <Title t="이번 run 요약" />
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
        {[
          { k: '소요', v: `${Math.round(durationMs / 1000)}초` },
          { k: 'LLM 호출', v: `${usage.calls}회` },
          { k: '토큰', v: `${(usage.inTok + usage.outTok).toLocaleString('ko-KR')}` },
          { k: '비용', v: `$${usage.costUsd.toFixed(3)}` },
        ].map((m) => (
          <div key={m.k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12.4, color: 'var(--ink-3)' }}>{m.k}</span>
            <span className="mono" style={{ fontSize: 21, fontWeight: 700 }}>{m.v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderTop: '1px solid var(--hair)', paddingTop: 9 }}>
        <span style={{ fontSize: 12.4, color: 'var(--ink-3)', flexShrink: 0 }}>결정</span>
        <span style={{ fontSize: 14.4, fontWeight: 700 }}>{decision}</span>
      </div>
    </div>
  );
}

/* ── 데이터 수집 (Agent 2) — ArgoCD·비즈니스 이벤트·Loki·프롬프트 제작을 진행형 단계로 크게 ── */
const COLLECT_STEPS: { k: string; v: string; tone: 'dim' | 'warn' | 'crit' }[] = [
  { k: 'ArgoCD', v: '최근 배포 없음 · 마지막 6h 전', tone: 'dim' },
  { k: '비즈니스 이벤트', v: 'CJ 온스타일 라이브 커머스 방송 시작 10:02', tone: 'warn' },
  { k: 'Loki', v: '최근 5분 ERROR 612건 · "connection pool exhausted" 외 3개', tone: 'crit' },
  { k: '프롬프트 제작', v: '정형 템플릿 + 장애 등급 G1~G3', tone: 'dim' },
];

// '수집 소스 스캔' 로그(i-collect)가 뜨는 시각과 맞물려 1·2·3(ArgoCD·비즈니스 이벤트·Loki)이 순서대로 체크된다
const COLLECT_SCAN_T = 16_000;
const COLLECT_SCAN_STAGGER = 1_100;
const COLLECT_SCAN_COUNT = 3; // '프롬프트 제작'(4번째)은 이 체크 애니메이션 대상이 아니다

function CollectProgressCard({ t }: { t: number }) {
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 18 })}>
      <span style={{ fontSize: 17, fontWeight: 600, flexShrink: 0 }}>데이터 수집</span>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-evenly' }}>
        {COLLECT_STEPS.map((s, i) => {
          const scanned = i < COLLECT_SCAN_COUNT;
          const checkedAt = COLLECT_SCAN_T + i * COLLECT_SCAN_STAGGER;
          const checked = scanned && t >= checkedAt;
          return (
            <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span
                className="mono"
                style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: checked ? '#8bc34a' : 'var(--ink-3)', color: checked ? '#ffffff' : '#0b0b0d',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15.5, fontWeight: 800,
                  transition: 'background .3s ease',
                }}
              >
                {checked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                ) : (i + 1)}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: checked ? '#ffffff' : 'var(--ink-3)', transition: 'color .3s ease' }}>{s.k}</span>
                <span className="mono" style={{ fontSize: 15.4, color: 'var(--ink-2)', lineHeight: 1.55, overflowWrap: 'break-word' }}>{s.v}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 탐지 · 동적 베이스라인 이탈 (Agent 2) ───── */
const DETECT_AMP_BASELINE = 168;
const DETECT_CW_BASELINE = 182;
const DETECT_STATIC_THRESHOLD = 500;

const DETECT_CHART_W = 320;
const DETECT_CHART_H = 200;
const DETECT_Y_MAX = 900;

/** 베이스라인 밴드(168~182ms) + 정적 임계값(500ms) + 실측 P99 추이를 그래프 하나로 — 라벨은 그래프 위에 얹는다
    (텍스트 줄로 나열하던 수치를 전부 이 안으로 흡수했다) */
function DetectMiniChart({ samples, idx }: { samples: TenantSample[]; idx: number }) {
  const shown = samples.slice(0, idx + 1);
  const xOf = (i: number) => (i / Math.max(1, samples.length - 1)) * DETECT_CHART_W;
  const yOf = (v: number) => DETECT_CHART_H - (Math.min(v, DETECT_Y_MAX) / DETECT_Y_MAX) * DETECT_CHART_H;
  const pctOf = (v: number) => (1 - Math.min(v, DETECT_Y_MAX) / DETECT_Y_MAX) * 100;
  return (
    <div style={{ position: 'relative', width: '100%', flexGrow: 1, minHeight: 0 }}>
      <svg viewBox={`0 0 ${DETECT_CHART_W} ${DETECT_CHART_H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="동적 베이스라인 대비 실측 P99 추이">
        <rect x={0} y={yOf(DETECT_CW_BASELINE)} width={DETECT_CHART_W} height={Math.max(0, yOf(DETECT_AMP_BASELINE) - yOf(DETECT_CW_BASELINE))} fill="rgba(144,133,233,.20)" />
        <line x1="0" y1={yOf(DETECT_STATIC_THRESHOLD)} x2={DETECT_CHART_W} y2={yOf(DETECT_STATIC_THRESHOLD)} stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <polyline
          fill="none" stroke="#d03b3b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
          points={shown.map((sm, i) => `${xOf(i).toFixed(1)},${yOf(sm.p99.cgv).toFixed(1)}`).join(' ')}
        />
      </svg>
      <span style={{ position: 'absolute', left: 6, top: `${pctOf(DETECT_CW_BASELINE)}%`, transform: 'translateY(-100%)', fontSize: 12.4, color: '#9085e9', fontWeight: 600, whiteSpace: 'nowrap' }}>
        AMP 168ms · CloudWatch 182ms — 최근 30분 동적 베이스라인
      </span>
      <span style={{ position: 'absolute', left: 6, top: `${pctOf(DETECT_STATIC_THRESHOLD)}%`, transform: 'translateY(-100%)', fontSize: 12.4, color: 'var(--warn)', fontWeight: 700, whiteSpace: 'nowrap' }}>
        정적 임계값 500ms (세이프티넷)
      </span>
    </div>
  );
}

function DetectAnomalyCard({ sample, samples, idx }: { sample: TenantSample; samples: TenantSample[]; idx: number }) {
  const now = sample.p99.cgv;
  const breached = now > Math.max(DETECT_AMP_BASELINE, DETECT_CW_BASELINE);
  return (
    <div className={breached ? 'card card-alert' : 'card'} style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 10 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15.7, fontWeight: 600 }}>이상 탐지 — 동적 베이스라인</span>
        <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>포인트 적립 P99 · CJ 온스타일</span>
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: 27, fontWeight: 800, color: breached ? '#d03b3b' : 'var(--ink)' }}>{now.toLocaleString('ko-KR')}ms</span>
      </div>
      <DetectMiniChart samples={samples} idx={idx} />
      {breached && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(208,59,59,.18)', border: '1.5px solid #d03b3b', borderRadius: 11, padding: '13px 18px', flexShrink: 0 }}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#d03b3b" strokeWidth="2.6" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#d03b3b' }}>동적 베이스라인을 벗어남!</span>
        </div>
      )}
    </div>
  );
}

/* ── 조치 · 런북 카탈로그 (Agent 2) ───────────
   13개 중 3개가 조합 상한 5개 안에서 선택된다. i-catalog(52s) → i-tier(56s) 구간에서
   하나씩 켜진다 — mockRun.ts 의 i-catalog/i-tier 타임스탬프와 맞춰둔 값이라 그쪽을 바꾸면 여기도 바꿔야 한다. */
const CATALOG_REVEAL_START = 52_000;
const CATALOG_REVEAL_END = 56_000;
const CATALOG_CAP = 5;
const CHOSEN_ORDER = ['RB-04', 'RB-05', 'RB-01'];
const CATALOG_ROWS: { ids: string[]; label: string; tag?: string }[] = [
  { ids: ['RB-01'], label: 'HPA 레플리카 상향', tag: 'k8s' },
  { ids: ['RB-02'], label: '파드 롤링 재시작', tag: 'k8s' },
  { ids: ['RB-03'], label: '테넌트 RPS 스로틀', tag: 'ratelimit' },
  { ids: ['RB-04'], label: 'RDS Proxy 커넥션 풀', tag: 'rds' },
  { ids: ['RB-05'], label: '슬로우 쿼리 종료', tag: '집행경로 없음' },
  { ids: ['RB-06', 'RB-07'], label: '노드풀 격리 · 노드 cordon' },
  { ids: ['RB-08', 'RB-09'], label: 'ArgoCD 롤백 · limit 상향' },
  { ids: ['RB-10'], label: 'RLS Redis 재시작', tag: 'k8s' },
  { ids: ['RB-11', 'RB-12'], label: '테넌트 통보 · 쿼터 핸드오프' },
  { ids: ['RB-13'], label: '무조치 · 에스컬레이션', tag: 'notify' },
];

function RunbookCatalogCard({ t }: { t: number }) {
  const ratio = clamp01((t - CATALOG_REVEAL_START) / (CATALOG_REVEAL_END - CATALOG_REVEAL_START));
  const count = Math.min(CHOSEN_ORDER.length, Math.floor(ratio * CHOSEN_ORDER.length + 1e-6));
  const chosenIds = new Set(CHOSEN_ORDER.slice(0, count));
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 12 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 17.5, fontWeight: 700 }}>런북 카탈로그 13개</span>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>조치 1개 = 런북 1개 = 리소스 1개</span>
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: 14.5, fontWeight: 700, color: count > 0 ? '#16a34a' : 'var(--ink-3)' }}>조합 {count}/{CATALOG_CAP}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexGrow: 1, minHeight: 0, justifyContent: 'space-evenly' }}>
        {CATALOG_ROWS.map((row) => {
          const chosen = row.ids.some((id) => chosenIds.has(id));
          return (
            <div
              key={row.ids.join('-')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 15px', borderRadius: 10,
                border: chosen ? '1.5px solid #16a34a' : '1px solid var(--hair)',
                background: chosen ? 'rgba(22,163,74,.14)' : 'var(--surface-2)',
                transition: 'background .3s, border-color .3s',
              }}
            >
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: chosen ? '#16a34a' : 'var(--ink-3)', flexShrink: 0 }}>
                {row.ids.join(' · ')}
              </span>
              <span style={{ fontSize: 15, color: chosen ? 'var(--ink)' : 'var(--ink-3)', flexGrow: 1 }}>{row.label}</span>
              {row.tag && <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink-3)', flexShrink: 0 }}>({row.tag})</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 13.4, color: 'var(--ink-3)', borderTop: '1px solid var(--hair)', paddingTop: 9, lineHeight: 1.6, flexShrink: 0 }}>
        RB-03 제외 — 원인은 수요가 아니라 처리 병목 · 티어 T2 · Slack 승인 · 타임아웃 600초
      </div>
    </div>
  );
}

/* ── p99 (Agent 2 진단) ───────────────────────── */
const P_W = 560, P_H = 300, Y_MAX = 2400, TICKS = [1000, 2000];
function P99Card({ samples, idx, sloMs, showGoalMark, tenants }: { samples: TenantSample[]; idx: number; sloMs: number; showGoalMark?: boolean; tenants?: TenantKey[] }) {
  const shown = samples.slice(0, idx + 1);
  const rows = tenants ?? TENANT_ORDER;
  const xOf = (i: number) => (i / (samples.length - 1)) * P_W;
  const yOf = (v: number) => P_H - (Math.min(v, Y_MAX) / Y_MAX) * P_H;
  // 목표(SLO) 도달 지점 — CJ 온스타일 P99 가 SLO 아래로 처음 내려온 순간을 짚어준다
  const goalIdx = showGoalMark ? shown.findIndex((sm) => sm.p99.cgv <= sloMs) : -1;
  return (
    <div className="card" style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 15.7, fontWeight: 600 }}>테넌트별 p99</span>
        <span style={{ fontSize: 12.9, color: 'var(--ink-3)' }}>SLO {sloMs}ms</span>
        <span style={{ flexGrow: 1 }} />
        {rows.map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4.6 }}>
            <span style={{ width: 11, height: 3, borderRadius: 2, background: TENANTS[k].color }} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{TENANTS[k].label}</span>
          </span>
        ))}
      </div>
      <div style={{ flexGrow: 1, minHeight: 0, position: 'relative', paddingRight: 30 }}>
        <svg viewBox={`0 0 ${P_W} ${P_H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="테넌트별 p99 시계열">
          <line x1="0" y1={P_H} x2={P_W} y2={P_H} stroke="var(--rule)" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={yOf(sloMs)} x2={P_W} y2={yOf(sloMs)} stroke="var(--warn)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          {TICKS.map((v) => (
            <line key={v} x1="0" y1={yOf(v)} x2={P_W} y2={yOf(v)} stroke="var(--hair)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {rows.map((k) => (
            <polyline key={k} fill="none" stroke={TENANTS[k].color} strokeWidth={k === 'cgv' ? 2.6 : 1.9} strokeLinejoin="round" vectorEffect="non-scaling-stroke"
              points={shown.map((sm, i) => `${xOf(i).toFixed(1)},${yOf(sm.p99[k]).toFixed(1)}`).join(' ')} />
          ))}
          {goalIdx >= 0 && (
            <circle cx={xOf(goalIdx)} cy={yOf(shown[goalIdx].p99.cgv)} r="4.2" fill="#16a34a" stroke="var(--surface)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {goalIdx >= 0 && (
          <span
            className="mono"
            style={{
              position: 'absolute', left: `${(goalIdx / (samples.length - 1)) * 100}%`,
              top: `${(1 - Math.min(shown[goalIdx].p99.cgv, Y_MAX) / Y_MAX) * 100}%`,
              transform: 'translate(8px, -130%)', fontSize: 11.5, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap',
            }}
          >
            SLO 도달 · {shown[goalIdx].p99.cgv.toLocaleString('ko-KR')}ms
          </span>
        )}
        <span style={{ position: 'absolute', right: 0, top: `${(1 - Math.min(sloMs, Y_MAX) / Y_MAX) * 100}%`, transform: 'translateY(-50%)', fontSize: 12, color: 'var(--warn)', whiteSpace: 'nowrap' }}>SLO</span>
        {TICKS.filter((v) => v !== sloMs).map((v) => (
          <span key={v} style={{ position: 'absolute', right: 0, top: `${(1 - v / Y_MAX) * 100}%`, transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{v / 1000}s</span>
        ))}
      </div>
    </div>
  );
}

/* ── 단계에 맞는 자료를 고른다 ────────────────── */
export default function Slot({ agent, phase, t, sample, samples, idx, sloMs, projection, usage, durationMs }: {
  agent: AgentId;
  phase: Phase;
  t: number;
  sample: TenantSample;
  samples: TenantSample[];
  idx: number;
  sloMs: number;
  projection: Projection;
  usage: { inTok: number; outTok: number; calls: number; costUsd: number };
  durationMs: number;
}) {
  if (agent === 'quota') {
    if (phase === 'detect') return <GaugeCard sample={sample} tenant="oliveyoung" />;
    if (phase === 'triage') return (<><ScheduleCard /><ForecastCard t={t} /></>);
    if (phase === 'diagnose') return (<><GapCard projection={projection} /><ForecastCard t={t} /></>);
    if (phase === 'act') return <BeforeAfterCard projection={projection} />;
    if (phase === 'cooldown') return (
      <LinesCard title="쿨다운" sub="재발화 억제 · 회수 조건 감시" lines={[
        { k: '재발화 차단', v: 'quota-locks TTL 5분', tone: 'dim' },
        { k: '회수 조건', v: '사용률 40% 미만 30분 지속 → 노드풀 반납' },
        { k: '다음', v: '다음 트리거까지 사용률 추이만 지켜본다', tone: 'dim' },
      ]} />
    );
    return <SummaryCard agent={agent} usage={usage} durationMs={durationMs} />;
  }

  if (phase === 'detect') return <DetectAnomalyCard sample={sample} samples={samples} idx={idx} />;
  if (phase === 'collect') return <CollectProgressCard t={t} />;
  if (phase === 'diagnose') return <P99Card samples={samples} idx={idx} sloMs={sloMs} tenants={TENANT_ORDER.filter((k) => k !== 'oliveyoung')} />;
  if (phase === 'act') return <RunbookCatalogCard t={t} />;
  if (phase === 'cooldown') return (
    <>
      <LinesCard grow={false} title="마일스톤 확인" sub="모니터링 600초" lines={[
        { k: 'M1', v: '4분 내 대기 커넥션 50건 이하 · +210s 38건', tone: 'good' },
        { k: 'M2', v: '7분 내 P99 SLO(1.0s) 이내 · +260s 620ms', tone: 'good' },
        { k: '미도달이면', v: '재진단 1회 → 2회째 사람에게 에스컬레이션', tone: 'dim' },
      ]} />
      <P99Card samples={samples} idx={idx} sloMs={sloMs} showGoalMark />
    </>
  );
  return <SummaryCard agent={agent} usage={usage} durationMs={durationMs} />;
}
