import { useEffect, useRef, useState } from 'react';
import { TENANTS } from '../../lib/tenants';
import type { TenantKey } from '../../lib/types';

/** 진단이 끝나는 순간 화면 가운데 뜨는 결정 카드 */
export default function ComboPopup({
  tenant, action, sub, shortfall, quotaFrom, quotaTo, reason, onClose,
}: {
  tenant: TenantKey;
  /** 무엇을 하기로 했는가 */
  action: string;
  /** 왜 그 결론인가 — 한 줄 */
  sub: string;
  /** 부족분 (rps) */
  shortfall?: number;
  quotaFrom: number;
  quotaTo: number;
  reason?: string;
  onClose: () => void;
}) {
  // 리플레이가 매 프레임 렌더를 돌리므로 onClose 를 ref 로 고정한다.
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
          position: 'relative', width: 'min(696px, calc(100vw - 48px))',
          padding: '31px 36px 29px', display: 'flex', flexDirection: 'column', gap: 18,
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

        <div style={{ alignSelf: 'flex-start' }}>
          <span className="chip chip-warn" style={{ fontSize: 15, padding: '5px 12px' }}>
            관리자 승인 대기중<span className="dots">.....</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, fontSize: 30, fontWeight: 700, lineHeight: 1.25, paddingRight: 31 }}>
          <span style={{ color: to.color }}>{to.label}</span>
          <span>{action}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17.4, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ink-2)' }}>{sub}</span>
          {typeof shortfall === 'number' && (
            <span className="chip chip-crit" style={{ fontSize: 15, padding: '4px 12px' }}>
              부족 {shortfall.toLocaleString('ko-KR')} rps
            </span>
          )}
        </div>

        <div
          style={{
            background: 'var(--surface-2)', border: `1px solid ${to.color}`, borderRadius: 14,
            padding: '17px 19px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 15.6, color: 'var(--ink-3)' }}>{to.label} 쿼터</span>
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 12, fontSize: 31, fontWeight: 700 }}>
            <span style={{ color: 'var(--ink)' }}>{quotaFrom.toLocaleString('ko-KR')}</span>
            <span style={{ color: 'var(--ink-3)', fontSize: 24 }}>→</span>
            <span style={{ color: to.color }}>{quotaTo.toLocaleString('ko-KR')}</span>
            <span style={{ fontSize: 16.8, color: 'var(--ink-3)', fontWeight: 400 }}>rps</span>
          </span>
          <span style={{ marginLeft: 'auto' }} />
          <span className="chip" style={{ background: 'rgba(22,163,74,.16)', color: '#16a34a', fontSize: 15.6, padding: '5px 13px' }}>
            +{(quotaTo - quotaFrom).toLocaleString('ko-KR')} rps
          </span>
        </div>

        {reason && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--hair)', borderRadius: 12, padding: '14px 17px', fontSize: 16.2, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            {reason}
          </div>
        )}

        <div style={{ fontSize: 14.4, color: 'var(--ink-3)' }}>
          {secondsLeft}초 뒤 자동으로 닫힙니다 · × 또는 Esc 로 바로 닫기 · 인프라 변경이라 Slack 승인을 거쳐 집행된다
        </div>
      </div>
    </div>
  );
}
