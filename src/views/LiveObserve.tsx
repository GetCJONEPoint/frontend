import ObservePanel from '../components/console/ObservePanel';
import { useLiveMetrics } from '../lib/liveMetrics';

// mockRun.ts의 SLO_MS와 동일 — 리플레이 화면과 기준선을 맞춘다.
const SLO_MS = 300;

export default function LiveObserve() {
  const { samples, usage, error } = useLiveMetrics();

  if (samples.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)' }}>
        {error ? `지표 조회 실패: ${error}` : '지표 불러오는 중…'}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>실시간 지표</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>RED(요청량·지연시간) + Bedrock 사용량</span>
        <span style={{ flexGrow: 1 }} />
        {error && <span className="chip chip-warn">최근 갱신 실패 · 이전 값 표시 중 ({error})</span>}
        <span className="chip chip-good">실시간 · 10초 주기</span>
      </div>

      <div style={{ flexGrow: 1, padding: '16px 20px', minHeight: 0, display: 'flex' }}>
        <ObservePanel
          samples={samples}
          idx={samples.length - 1}
          sloMs={SLO_MS}
          posCalls={[]}
          tenantTotal={4}
          usage={usage}
        />
      </div>
    </div>
  );
}
