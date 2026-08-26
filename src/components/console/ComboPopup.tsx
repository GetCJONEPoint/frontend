import { useEffect } from 'react';
import { TENANTS, TENANT_ORDER } from '../../lib/tenants';
import type { TenantKey } from '../../lib/types';

/** "CJ ONSTYLE 300" 같은 조각에서 테넌트를 찾아 색을 입힌다 */
function tenantOf(part: string): TenantKey | null {
  return TENANT_ORDER.find((k) => part.startsWith(TENANTS[k].label)) ?? null;
}

export default function ComboPopup({
  label, reason, total, toTenant, quotaFrom, quotaTo, onClose,
}: {
  label: string;
  reason?: string;
  total?: number;
  toTenant: TenantKey;
  quotaFrom: number;
  quotaTo: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parts = label.split('+').map((p) => p.trim());
  const to = TENANTS[toTenant];

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
          position: 'relative', width: 'min(560px, calc(100vw - 48px))',
          padding: '26px 30px 24px', display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 24px 70px rgba(0,0,0,.6)',
          animation: 'popup-in .24s cubic-bezier(.34,1.4,.64,1) both',
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute', top: 12, right: 12, width: 30, height: 30,
            borderRadius: 8, fontSize: 19, lineHeight: 1, color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 10px', fontSize: 25, fontWeight: 700, lineHeight: 1.25 }}>
          {parts.map((p, i) => {
            const k = tenantOf(p);
            return (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
                {i > 0 && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>+</span>}
                <span style={{ color: k ? TENANTS[k].color : 'var(--ink)' }}>{p}</span>
              </span>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16 }}>
          <span style={{ color: 'var(--ink-3)' }}>→</span>
          <span style={{ color: to.color, fontWeight: 700 }}>{to.label}</span>
          <span style={{ color: 'var(--ink-2)' }}>에 할당</span>
          {typeof total === 'number' && (
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--ink-3)' }}>
              합 {total} rps
            </span>
          )}
        </div>

        <div
          style={{
            background: 'var(--surface-2)', border: `1px solid ${to.color}`, borderRadius: 12,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{to.label} 쿼터</span>
          <span className="mono" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10, fontSize: 26, fontWeight: 700 }}>
            <span style={{ color: 'var(--ink-3)' }}>{quotaFrom.toLocaleString('ko-KR')}</span>
            <span style={{ color: 'var(--ink-3)', fontSize: 20 }}>→</span>
            <span style={{ color: to.color }}>{quotaTo.toLocaleString('ko-KR')}</span>
            <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}>rps</span>
          </span>
          <span style={{ marginLeft: 'auto' }} />
          <span className="chip" style={{ background: 'rgba(22,163,74,.16)', color: '#16a34a', fontSize: 13, padding: '4px 11px' }}>
            +{(quotaTo - quotaFrom).toLocaleString('ko-KR')} rps
          </span>
        </div>

        {reason && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--hair)', borderRadius: 10, padding: '12px 14px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            {reason}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          닫으려면 × 또는 Esc · 이후 결정론 검증 5종을 통과해야 집행된다
        </div>
      </div>
    </div>
  );
}
