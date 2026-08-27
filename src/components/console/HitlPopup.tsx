import { useEffect, useRef, useState } from 'react';
import { TENANTS } from '../../lib/tenants';
import type { TenantKey } from '../../lib/types';

/** HITL — 사람이 승인 버튼을 눌러야 하는 순간에 뜨는 알림 */
export default function HitlPopup({
  tenant, tier, symptom, plan, expected, timeoutSec, approver, onClose,
}: {
  tenant: TenantKey;
  tier: string;
  symptom: string;
  plan: { id: string; name: string; param?: string }[];
  expected?: string;
  timeoutSec: number;
  approver?: string;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          closeRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1_000);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearInterval(timer);
    };
  }, []);

  const to = TENANTS[tenant];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'popup-fade .18s ease-out both',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: 'min(720px, calc(100vw - 48px))',
          padding: '31px 36px 29px', display: 'flex', flexDirection: 'column', gap: 18,
          border: '1px solid var(--warn)',
          boxShadow: '0 24px 70px rgba(0,0,0,.6)',
          animation: 'popup-in .24s cubic-bezier(.34,1.4,.64,1) both',
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute', top: 14, right: 14, width: 36, height: 36,
            borderRadius: 9, fontSize: 23, lineHeight: 1, color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, fontSize: 30, fontWeight: 700, lineHeight: 1.25, paddingRight: 36 }}>
          <span style={{ color: to.color }}>{to.label}</span>
          <span>장애 조치 승인 요청</span>
          <span className="chip chip-warn" style={{ fontSize: 15.6, padding: '5px 13px', alignSelf: 'center' }}>{tier} · HITL</span>
        </div>

        <div style={{ fontSize: 17.4, color: 'var(--ink-2)' }}>{symptom}</div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--warn)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {plan.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 15, color: 'var(--ink-3)', flexShrink: 0 }}>{i + 1}.</span>
              <span className="mono" style={{ fontSize: 16.8, fontWeight: 700, color: 'var(--warn)', flexShrink: 0 }}>{r.id}</span>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{r.name}</span>
              <span style={{ flexGrow: 1 }} />
              {r.param && <span className="mono" style={{ fontSize: 15.6, color: 'var(--ink-3)' }}>{r.param}</span>}
            </div>
          ))}
        </div>

        {expected && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 16.3 }}>
            <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>예상 결과</span>
            <span style={{ color: 'var(--ink-2)' }}>{expected}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--hair)', paddingTop: 14 }}>
          <span className="chip chip-warn pulse" style={{ fontSize: 15.6, padding: '5px 13px' }}>Slack 승인 대기</span>
          <span className="mono" style={{ fontSize: 16, color: 'var(--ink-2)' }}>타임아웃 {timeoutSec}초</span>
          {approver && <span className="mono" style={{ fontSize: 16, color: '#16a34a', fontWeight: 700 }}>{approver}</span>}
          <span style={{ flexGrow: 1 }} />
          <span style={{ fontSize: 14.9, color: 'var(--ink-3)' }}>시간 내 승인이 없으면 실행하지 않는다</span>
        </div>

        <div style={{ fontSize: 14.4, color: 'var(--ink-3)' }}>
          {secondsLeft}초 뒤 자동으로 닫힙니다 · × 또는 Esc 로 바로 닫기
        </div>
      </div>
    </div>
  );
}
