import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import {
  BUSINESS_EVENTS, FORECAST,
  buildDetectSeries, DETECT_LEAD_MS, DETECT_SPAN_MS, DETECT_STATIC_MS,
  type DetectPoint,
} from '../../lib/mockRun';
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
  { k: 'ArgoCD', v: '최근 배포 없음', tone: 'dim' },
  { k: 'DynamoDB', v: '비즈니스 이벤트CJ 온스타일 라이브 커머스 방송', tone: 'warn' },
  { k: 'Loki', v: '최근 5분 ERROR 612건', tone: 'crit' },
  { k: '프롬프트 제작', v: '정형 템플릿 + 장애 등급 G1~G3', tone: 'dim' },
];

// 탐지가 끝나고 데이터 수집이 시작되는 바로 그 순간(i-collect, t=8s) 1·2·3(ArgoCD·비즈니스 이벤트·Loki)이 순서대로 체크된다
const COLLECT_SCAN_T = 8_000;
const COLLECT_SCAN_STAGGER = 900;
const COLLECT_SCAN_COUNT = 4; // 1·2·3에 이어 4(프롬프트 제작)도 순차 체크된다 — i-collect 박스의 '장애 등급 산출 → 프롬프트 제작' 문구(t=10.7s)와 맞물린다

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

/* ── 탐지 · 동적 베이스라인 이탈 (Agent 2) ─────────
   보여줄 게 둘이라 축을 둘 다 바꿨다.
   ① 세로는 로그축 — 14ms 짜리 임계 간격(AMP 168 · CW 182)과 673ms 급등을 한 화면에 같이 담아야 한다.
      선형축에선 베이스라인이 1.5% 두께 실선으로 뭉개져 "동적"인지 보이지가 않는다.
   ② 가로는 탐지 구간 20초(리드인 12초 + 탐지 8초)만 — 80초 run 축에 얹으면 왼쪽 7%에 뭉개진다. */
const D_W = 400, D_H = 210;
const D_Y_LO = 100, D_Y_HI = 900;
// 200 눈금은 뺐다 — 로그축에서 베이스라인(~182) 라벨과 7px 차이라 글자가 겹친다
const D_TICKS = [300, 500];
const DETECT_SERIES = buildDetectSeries();

const dY = (v: number) => {
  const c = Math.min(D_Y_HI, Math.max(D_Y_LO, v));
  return D_H - ((Math.log(c) - Math.log(D_Y_LO)) / (Math.log(D_Y_HI) - Math.log(D_Y_LO))) * D_H;
};
const dYPct = (v: number) => (dY(v) / D_H) * 100;
const dX = (t: number) => ((t + DETECT_LEAD_MS) / DETECT_SPAN_MS) * D_W;
const dXPct = (t: number) => ((t + DETECT_LEAD_MS) / DETECT_SPAN_MS) * 100;
const dPt = (p: DetectPoint, v: number) => `${dX(p.t).toFixed(1)},${dY(v).toFixed(1)}`;

const LegendKey = ({ swatch, label }: { swatch: React.ReactNode; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    {swatch}
    <span style={{ fontSize: 11.6, color: 'var(--ink-3)' }}>{label}</span>
  </span>
);

/** 동적 임계 밴드 + 정적 임계값 + 실측 P99 를 하나의 시계열로. 이탈분은 면적으로 칠한다. */
function DetectMiniChart({ shown, breachAt, staticAt }: { shown: DetectPoint[]; breachAt: number; staticAt: number }) {
  // 이탈 구간은 직전 점부터 이어 그려야 선이 끊기지 않는다
  const over = breachAt >= 0 ? shown.slice(Math.max(0, breachAt - 1)) : [];
  const band = shown.map((p) => dPt(p, p.cw)).join(' ') + ' '
    + [...shown].reverse().map((p) => dPt(p, p.amp)).join(' ');
  const excess = over.length > 1
    ? over.map((p) => dPt(p, p.p99)).join(' ') + ' ' + [...over].reverse().map((p) => dPt(p, p.cw)).join(' ')
    : '';
  const bp = breachAt >= 0 ? shown[breachAt] : null;
  const sp = staticAt >= 0 ? shown[staticAt] : null;

  return (
    <div style={{ position: 'relative', flexGrow: 1, minHeight: 0, paddingRight: 42 }}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg viewBox={`0 0 ${D_W} ${D_H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="동적 베이스라인 대비 CJ 온스타일 적립 P99 추이">
          {D_TICKS.map((v) => (
            <line key={v} x1={0} y1={dY(v)} x2={D_W} y2={dY(v)} stroke="var(--hair)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}

          {/* 정적 임계값 — 세이프티넷 */}
          <line x1={0} y1={dY(DETECT_STATIC_MS)} x2={D_W} y2={dY(DETECT_STATIC_MS)} stroke="var(--warn)" strokeWidth={2.2} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />

          {/* 동적 임계 — AMP·CloudWatch 두 선과 그 사이 밴드. 계속 미세하게 움직인다 */}
          <polygon points={band} fill="rgba(144,133,233,.26)" />
          <polyline fill="none" points={shown.map((p) => dPt(p, p.cw)).join(' ')} stroke="#9085e9" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
          <polyline fill="none" points={shown.map((p) => dPt(p, p.amp)).join(' ')} stroke="#9085e9" strokeWidth={1.4} strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />

          {/* 이탈분 — 임계 위로 삐져나간 면적을 통째로 칠한다. 이게 제일 먼저 눈에 들어와야 한다 */}
          {excess && <polygon points={excess} fill="rgba(208,59,59,.34)" />}

          {/* 실측 P99 — 밴드 안은 차분하게, 이탈 후는 굵은 빨강 */}
          <polyline fill="none" points={shown.map((p) => dPt(p, p.p99)).join(' ')} stroke="var(--ink-3)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {over.length > 1 && (
            <polyline fill="none" points={over.map((p) => dPt(p, p.p99)).join(' ')} stroke="#d03b3b" strokeWidth={4.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {bp && (
            <line x1={dX(bp.t)} y1={dY(bp.p99)} x2={dX(bp.t)} y2={D_H} stroke="#d03b3b" strokeWidth={1.3} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* 표식은 HTML 로 얹는다 — SVG 가 가로로 늘어나 원이 타원이 되는 걸 피한다 */}
        {bp && <Dot x={dXPct(bp.t)} y={dYPct(bp.p99)} color="#d03b3b" />}
        {sp && <Dot x={dXPct(sp.t)} y={dYPct(sp.p99)} color="var(--warn)" />}
        {bp && (
          <span className="mono" style={{ position: 'absolute', left: `${dXPct(bp.t)}%`, top: `${dYPct(bp.p99)}%`, transform: 'translate(9px, -155%)', fontSize: 11.4, fontWeight: 700, color: '#d03b3b', whiteSpace: 'nowrap' }}>
            이탈 t+{(bp.t / 1000).toFixed(1)}s
          </span>
        )}

        {shown.length > 0 && shown[shown.length - 1].p99 > shown[shown.length - 1].cw && (
          <div
            style={{
              position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              background: 'rgba(208,59,59,.20)', border: '1.5px solid #d03b3b', borderRadius: 8, padding: '6px 12px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d03b3b" strokeWidth="2.6" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M12 8v5" /><path d="M12 16.5v.5" /><circle cx="12" cy="12" r="9" />
            </svg>
            <span style={{ fontSize: 13.4, fontWeight: 800, color: '#d03b3b' }}>동적 베이스라인을 벗어남!</span>
          </div>
        )}
      </div>

      {/* 오른쪽 여백에 눈금값 — 그래프 위로 겹치지 않는다 */}
      <span style={{ position: 'absolute', right: 0, top: `${dYPct(DETECT_STATIC_MS)}%`, transform: 'translateY(-50%)', fontSize: 11.4, fontWeight: 700, color: 'var(--warn)', whiteSpace: 'nowrap' }}>500</span>
      {D_TICKS.filter((v) => v !== DETECT_STATIC_MS).map((v) => (
        <span key={v} style={{ position: 'absolute', right: 0, top: `${dYPct(v)}%`, transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{v}</span>
      ))}
      <span style={{ position: 'absolute', right: 0, top: `${dYPct(178)}%`, transform: 'translateY(-50%)', fontSize: 11, color: '#9085e9', fontWeight: 700, whiteSpace: 'nowrap' }}>~182</span>
    </div>
  );
}

const Dot = ({ x, y, color }: { x: number; y: number; color: string }) => (
  <span style={{
    position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
    width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: '0 0 0 2px var(--surface)',
  }} />
);

function DetectAnomalyCard({ t }: { t: number }) {
  const shown = DETECT_SERIES.filter((p) => p.t <= t);
  if (shown.length === 0) return <div className="card" style={card({ flexGrow: 1 })} />;

  const last = shown[shown.length - 1];
  const breachAt = shown.findIndex((p) => p.p99 > p.cw);
  const staticAt = shown.findIndex((p) => p.p99 > DETECT_STATIC_MS);
  const breached = last.p99 > last.cw;
  const ratio = last.p99 / last.cw;

  // 이 화면의 논거 — 동적 베이스라인이 정적 임계값보다 먼저 잡는다
  const foot = breachAt < 0
    ? '실측 P99 가 동적 임계 아래 — 정상 범위'
    : staticAt < 0
      ? `동적 베이스라인 t+${(shown[breachAt].t / 1000).toFixed(1)}s 이탈 · 정적 임계값(500ms)은 아직 미도달`
      : `동적 t+${(shown[breachAt].t / 1000).toFixed(1)}s · 정적 t+${(shown[staticAt].t / 1000).toFixed(1)}s — ${((shown[staticAt].t - shown[breachAt].t) / 1000).toFixed(1)}초 먼저 잡았다`;

  return (
    <div className={breached ? 'card card-alert' : 'card'} style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, justifyContent: 'flex-start', gap: 8 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9.2, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15.7, fontWeight: 600 }}>이상 탐지 — 동적 베이스라인</span>
        <span style={{ fontSize: 12.6, color: 'var(--ink-3)' }}>포인트 적립 P99 · CJ 온스타일</span>
        <span style={{ flexGrow: 1 }} />
        {breached && (
          <span className="mono" style={{ fontSize: 12.6, fontWeight: 700, color: '#d03b3b' }}>베이스라인 ×{ratio.toFixed(1)}</span>
        )}
        <span className="mono" style={{ fontSize: 27, fontWeight: 800, color: breached ? '#d03b3b' : 'var(--ink)' }}>{last.p99.toLocaleString('ko-KR')}ms</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap', flexShrink: 0 }}>
        <LegendKey label="적립 P99 실측" swatch={<span style={{ width: 13, height: 3, borderRadius: 2, background: '#d03b3b' }} />} />
        <LegendKey label="동적 임계 AMP·CloudWatch (최근 30분 학습)" swatch={<span style={{ width: 13, height: 7, borderRadius: 2, background: 'rgba(144,133,233,.45)', border: '1px solid #9085e9' }} />} />
        <LegendKey label="정적 임계값 500ms" swatch={<span style={{ width: 13, height: 0, borderTop: '2px dashed var(--warn)' }} />} />
      </div>

      <DetectMiniChart shown={shown} breachAt={breachAt} staticAt={staticAt} />

      <div style={{ flexShrink: 0, fontSize: 12.2, color: breachAt >= 0 ? 'var(--ink-2)' : 'var(--ink-3)', borderTop: '1px solid var(--hair)', paddingTop: 7 }}>
        {foot}
      </div>
    </div>
  );
}

/* ── 조치 · 런북 카탈로그 (Agent 2) ───────────
   13개 중 3개가 조합 상한 5개 안에서 선택된다. i-catalog(52s) → i-tier(56s) 구간에서
   하나씩 켜진다 — mockRun.ts 의 i-catalog/i-tier 타임스탬프와 맞춰둔 값이라 그쪽을 바꾸면 여기도 바꿔야 한다. */
/* ── p99 (Agent 2 진단 · 조치) ───────────────────────── */
const P_W = 560, P_H = 300, Y_MAX = 2400, TICKS = [1000, 2000];
function P99Card({ samples, idx, sloMs, showGoalMark, tenants, alertOnBreach = true }: { samples: TenantSample[]; idx: number; sloMs: number; showGoalMark?: boolean; tenants?: TenantKey[]; alertOnBreach?: boolean }) {
  const shown = samples.slice(0, idx + 1);
  const rows = tenants ?? TENANT_ORDER;
  const xOf = (i: number) => (i / (samples.length - 1)) * P_W;
  const yOf = (v: number) => P_H - (Math.min(v, Y_MAX) / Y_MAX) * P_H;
  // 목표(SLO) 도달 지점 — CJ 온스타일 P99 가 SLO 아래로 처음 내려온 순간을 짚어준다
  const goalIdx = showGoalMark ? shown.findIndex((sm) => sm.p99.cgv <= sloMs) : -1;
  // 표시 중인 테넌트가 전부 SLO 를 넘은 시점부터 — 그래프 색은 그대로 두고 박스 전체를 빨갛게 깜빡인다 (탐지 페이지와 동일한 연출)
  const allBreached = alertOnBreach && shown.length > 0 && rows.every((k) => shown[shown.length - 1].p99[k] > sloMs);
  return (
    <div className={allBreached ? 'card card-alert' : 'card'} style={card({ flexGrow: 1, flexShrink: 1, minHeight: 92, gap: 6 })}>
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

  if (phase === 'detect') return <DetectAnomalyCard t={t} />;
  if (phase === 'collect') return <CollectProgressCard t={t} />;
  if (phase === 'diagnose') return <P99Card samples={samples} idx={idx} sloMs={sloMs} tenants={TENANT_ORDER.filter((k) => k !== 'oliveyoung')} />;
  if (phase === 'act') return <P99Card samples={samples} idx={idx} sloMs={sloMs} tenants={TENANT_ORDER.filter((k) => k !== 'oliveyoung')} alertOnBreach={false} />;
  // 마일스톤 확인은 오른쪽 로그(i-watch)에 이미 있으므로 왼쪽은 그래프가 칸 전체를 크게 채운다
  if (phase === 'cooldown') return <P99Card samples={samples} idx={idx} sloMs={sloMs} showGoalMark tenants={TENANT_ORDER.filter((k) => k !== 'oliveyoung')} />;
  return <SummaryCard agent={agent} usage={usage} durationMs={durationMs} />;
}
