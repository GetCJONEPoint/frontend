import { useEffect, useMemo, useState } from 'react';
import { TENANTS } from '../lib/tenants';
import type { PosCall, TenantKey } from '../lib/types';
import { fetchBalance, postEarn, postUse } from '../lib/api';
import { publish } from '../lib/bus';
import { fetchServerKeyStatus, keyReady, type ServerKeyStatus } from '../lib/keys';
import { getApiMode } from '../lib/mode';
import { setMockLoad } from '../lib/mockApi';
import ApiKeyPanel from '../components/ApiKeyPanel';

const won = (n: number) => n.toLocaleString('ko-KR');
const hhmmss = (d: Date) =>
  [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

function formatPhone(digits: string) {
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 7);
  const c = digits.slice(7, 11);
  return [a, b, c].filter(Boolean).join('-');
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return hhmmss(now);
}

export default function PosTerminal({ tenant }: { tenant: TenantKey }) {
  const meta = TENANTS[tenant];
  const clock = useClock();

  const [phone, setPhone] = useState('');
  const [member, setMember] = useState<{ name: string; grade: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [pointsUsed, setPointsUsed] = useState(0);
  const [showPointDialog, setShowPointDialog] = useState(false);

  const [log, setLog] = useState<PosCall[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadOn, setLoadOn] = useState(false);
  const [paid, setPaid] = useState<number | null>(null);

  const [showKeys, setShowKeys] = useState(false);
  const [server, setServer] = useState<ServerKeyStatus | null>(null);
  const [mode, setMode] = useState(getApiMode);

  const refreshKeyStatus = () => { void fetchServerKeyStatus().then(setServer); };
  useEffect(() => {
    refreshKeyStatus();
    const onKeys = () => setServer((s) => s);
    const onMode = () => setMode(getApiMode());
    window.addEventListener('cjone:keys', onKeys);
    window.addEventListener('cjone:mode', onMode);
    return () => {
      window.removeEventListener('cjone:keys', onKeys);
      window.removeEventListener('cjone:mode', onMode);
    };
  }, []);

  const ready = mode === 'mock' || keyReady(tenant, server);

  // 브라우저 탭 이름 — 창을 여러 개 띄우니 어느 창인지 바로 보이게
  useEffect(() => {
    document.title = `${tenant.toUpperCase()} POS`;
  }, [tenant]);

  const lines = useMemo(
    () => meta.menu.filter((m) => (cart[m.id] ?? 0) > 0).map((m) => ({ ...m, qty: cart[m.id] })),
    [cart, meta.menu],
  );
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const usable = Math.min(balance ?? 0, subtotal);
  const appliedPoints = Math.min(pointsUsed, usable);
  const payable = Math.max(0, subtotal - appliedPoints);
  const earnAmount = Math.round(payable * meta.earnRate);
  const lastCall = log[0];

  function record(call: PosCall) {
    setLog((prev) => [call, ...prev].slice(0, 6));
    publish({ type: 'pos-call', call });
  }

  function applyBalance(body: unknown, fallback?: number) {
    const b = (body as { balance?: number } | null)?.balance;
    if (typeof b === 'number') setBalance(b);
    else if (typeof fallback === 'number') setBalance(fallback);
  }

  async function onQuery() {
    setBusy('query');
    const { call, balance: b } = await fetchBalance(tenant);
    record(call);
    if (call.ok) {
      setMember({ name: meta.memberName, grade: meta.grade });
      if (typeof b?.balance === 'number') setBalance(b.balance);
    }
    setBusy(null);
  }

  async function onPay() {
    if (lines.length === 0) return;
    setBusy('pay');

    if (appliedPoints > 0) {
      const used = await postUse(tenant, appliedPoints);
      record(used.call);
      if (!used.call.ok) { setBusy(null); return; }
      applyBalance(used.body, (balance ?? 0) - appliedPoints);
    }

    const earned = await postEarn(tenant, earnAmount);
    record(earned.call);
    if (earned.call.ok) {
      applyBalance(earned.body);
      setPaid(earnAmount);
    }
    setBusy(null);
  }

  function resetTx() {
    setCart({});
    setPointsUsed(0);
    setPaid(null);
  }

  function newCustomer() {
    resetTx();
    setPhone('');
    setMember(null);
    setBalance(null);
    setLog([]);
  }

  function toggleLoad() {
    const next = !loadOn;
    setLoadOn(next);
    setMockLoad(tenant, next);
    publish({ type: 'load', tenant, on: next, rps: next ? 3584 : meta.baselineRps });
  }

  const bump = (id: string, delta: number) =>
    setCart((c) => {
      const next = Math.max(0, (c[id] ?? 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const keyPress = (d: string) => setPhone((p) => (p.length >= 11 ? p : p + d));

  return (
    <div className="pos">
      {/* ── 상단 바 ─────────────────────────────── */}
      <div style={{ height: 68, flexShrink: 0, background: '#16171a', display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {meta.logo ? (
            <img
              src={meta.logo}
              alt={meta.label}
              style={{ height: tenant === 'cgv' ? 27 : 34, maxWidth: 120, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16171a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5 21 8v8l-9 4.5L3 16V8z" /><path d="M3 8l9 4 9-4" />
              </svg>
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>POS</div>
        </div>
        <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,.14)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.brandColor }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{meta.storeName}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', background: 'rgba(255,255,255,.07)', padding: '3px 8px', borderRadius: 5 }}>
            x-tenant-id: {meta.tenantId}
          </span>
        </div>
        <div style={{ flexGrow: 1 }} />
        <button
          className={mode === 'mock' ? 'chip chip-warn' : ready ? 'chip chip-good' : 'chip chip-crit'}
          onClick={() => setShowKeys(true)}
          style={{ cursor: 'pointer' }}
        >
          {mode === 'mock' ? '목업 모드 · 백엔드 미연동' : ready ? '실서버 연결됨' : 'API 키 설정 필요'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: !lastCall ? 'var(--ink-3)' : lastCall.ok ? 'var(--good)' : 'var(--crit)' }} />
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>membership-api</span>
          <span className="mono" style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{lastCall ? `${lastCall.ms}ms` : '—'}</span>
        </div>
        <span className="mono" style={{ fontSize: 13, color: 'var(--ink-3)' }}>{meta.posId}</span>
        <span className="mono" style={{ fontSize: 15, color: '#fff' }}>{clock}</span>
      </div>

      {/* ── 본문 ────────────────────────────────── */}
      <div style={{ flexGrow: 1, display: 'flex', gap: 16, padding: 16, minHeight: 0 }}>

        {/* COL 1 — 회원 조회 */}
        <div className="pos-card" style={{ width: 318, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink-2)' }}>회원 조회</div>
          <div style={{ height: 56, border: '2px solid #16171a', borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 14px' }}>
            {phone.length === 0 ? (
              <span className="mono" style={{ fontSize: 20, color: 'var(--pos-ink-3)' }}>휴대폰 번호 입력</span>
            ) : (
              <span className="mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '.02em' }}>{formatPhone(phone)}</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="key" onClick={() => keyPress(d)}>{d}</button>
            ))}
            <button className="key key-alt" onClick={() => setPhone('')}>지움</button>
            <button className="key" onClick={() => keyPress('0')}>0</button>
            <button className="key key-alt" onClick={() => setPhone((p) => p.slice(0, -1))}>←</button>
          </div>

          <div style={{ flexGrow: 1 }} />
          <button
            className="big-btn"
            style={{ background: phone.length >= 8 ? '#16171a' : 'var(--pos-fill-2)', color: phone.length >= 8 ? '#fff' : 'var(--pos-ink-3)', height: 60 }}
            onClick={onQuery}
            disabled={busy !== null || phone.length < 8}
          >
            {busy === 'query' ? '조회 중…' : '회원 조회'}
          </button>
          <div className="mono" style={{ fontSize: 11, color: 'var(--pos-ink-3)', textAlign: 'center' }}>
            GET /v1/members/{meta.memberId}/balance
          </div>
        </div>

        {/* COL 2 — 회원 카드 + 메뉴판 */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

          <div className="pos-card" style={{ flexShrink: 0, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'nowrap', minHeight: 88 }}>
            {member === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--pos-ink-3)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, border: '1.5px dashed var(--pos-line)' }} />
                <span style={{ fontSize: 15 }}>전화번호를 입력하고 조회하세요</span>
              </div>
            ) : (
              <>
                <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 13, background: 'var(--pos-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--pos-ink-2)' }}>
                  {member.name[0]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 19, fontWeight: 700 }}>{member.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: meta.brandColor, padding: '2px 8px', borderRadius: 999 }}>{member.grade}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--pos-ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatPhone(phone)}</span>
                </div>
                <div style={{ width: 1, height: 40, flexShrink: 0, background: 'var(--pos-line)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--pos-ink-3)' }}>가용 포인트</span>
                  <span className="mono" style={{ fontSize: 25, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {balance === null ? '—' : won(balance)} <span style={{ fontSize: 15, color: 'var(--pos-ink-2)' }}>P</span>
                  </span>
                </div>
                <div style={{ flexGrow: 1 }} />
                <button
                  onClick={() => setShowPointDialog(true)}
                  disabled={subtotal === 0}
                  style={{
                    height: 52, padding: '0 16px', borderRadius: 11, fontSize: 14, fontWeight: 700,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    background: subtotal === 0 ? 'var(--pos-fill)' : 'var(--pos-point)',
                    color: subtotal === 0 ? 'var(--pos-ink-3)' : '#fff',
                  }}
                  title={subtotal === 0 ? '메뉴를 먼저 담아주세요' : 'CJ ONE 포인트 사용'}
                >
                  포인트 사용
                </button>
              </>
            )}
          </div>

          <div className="pos-card" style={{ flexGrow: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink-2)' }}>메뉴</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, alignContent: 'start' }}>
              {meta.menu.map((m) => {
                const qty = cart[m.id] ?? 0;
                return (
                  <div
                    key={m.id}
                    className="menu-tile"
                    data-active={qty > 0}
                    style={{ ['--tile-accent' as string]: meta.brandColor }}
                    onClick={() => bump(m.id, 1)}
                  >
                    {qty > 0 && (
                      <button
                        className="tile-x"
                        aria-label={`${m.name} 삭제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCart((c) => { const next = { ...c }; delete next[m.id]; return next; });
                        }}
                      >
                        ×
                      </button>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 600, paddingRight: 36 }}>{m.name}</div>
                    <div className="mono" style={{ fontSize: 15, color: 'var(--pos-ink-2)', paddingRight: 36 }}>{won(m.price)}원</div>
                    {qty > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <button className="step-btn" onClick={(e) => { e.stopPropagation(); bump(m.id, -1); }} aria-label="빼기">−</button>
                        <div className="mono" style={{ flexGrow: 1, textAlign: 'center', fontSize: 19, fontWeight: 700 }}>{qty}</div>
                        <button className="step-btn" onClick={(e) => { e.stopPropagation(); bump(m.id, 1); }} aria-label="더하기">+</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, height: 38 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COL 3 — 결제 항목 */}
        <div className="pos-card" style={{ width: 362, flexShrink: 0, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pos-ink-2)' }}>결제 항목</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--pos-ink-3)' }}>TX-260825-01947</span>
          </div>

          <div style={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
            {lines.length === 0 && (
              <div style={{ fontSize: 14, color: 'var(--pos-ink-3)', padding: '18px 0' }}>메뉴를 선택하세요</div>
            )}
            {lines.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--pos-fill)' }}>
                <span style={{ flexGrow: 1, fontSize: 15, fontWeight: 500 }}>{l.name}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--pos-ink-3)', width: 34, textAlign: 'right' }}>×{l.qty}</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 500, width: 92, textAlign: 'right' }}>{won(l.price * l.qty)}</span>
              </div>
            ))}

            {appliedPoints > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--pos-fill)' }}>
                <span style={{ flexGrow: 1, fontSize: 15, fontWeight: 600, color: 'var(--pos-point)' }}>CJ ONE 포인트 사용</span>
                <button
                  onClick={() => setPointsUsed(0)}
                  style={{ fontSize: 12, color: 'var(--pos-ink-3)', textDecoration: 'underline' }}
                >
                  취소
                </button>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, width: 92, textAlign: 'right', color: 'var(--pos-point)' }}>
                  −{won(appliedPoints)}
                </span>
              </div>
            )}
          </div>

          {subtotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pos-ink-3)' }}>
              <span>상품 합계</span>
              <span className="mono">{won(subtotal)}원</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 12, borderTop: '2px solid #16171a' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--pos-ink-2)' }}>결제 금액</span>
            <span className="mono" style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-.02em' }}>
              {won(payable)} <span style={{ fontSize: 17, color: 'var(--pos-ink-2)' }}>원</span>
            </span>
          </div>

          {paid !== null ? (
            <div style={{ background: '#eaf6ea', border: '1px solid rgba(12,163,12,.35)', borderRadius: 11, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a7a0a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
              <span style={{ fontSize: 14, color: '#0a5c0a', fontWeight: 600 }}>결제 완료 · {won(paid)}P 적립</span>
            </div>
          ) : (
            <div className="mono" style={{ fontSize: 12, color: 'var(--pos-ink-3)', textAlign: 'right' }}>
              적립 예정 +{won(earnAmount)}P
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="big-btn"
              style={{ flexGrow: 1, background: lines.length === 0 || paid !== null ? 'var(--pos-fill-2)' : meta.brandColor, color: lines.length === 0 || paid !== null ? 'var(--pos-ink-3)' : '#fff' }}
              onClick={onPay}
              disabled={busy !== null || lines.length === 0 || paid !== null}
            >
              {busy === 'pay' ? '결제 중…' : '결제하기'}
            </button>
            <button
              style={{ width: 96, borderRadius: 12, border: '1.5px solid rgba(11,11,11,.16)', fontSize: 14, fontWeight: 600, color: 'var(--pos-ink-2)' }}
              onClick={paid !== null ? resetTx : newCustomer}
            >
              {paid !== null ? '새 거래' : '전체 취소'}
            </button>
          </div>
        </div>
      </div>

      {/* ── API 호출 로그 ──────────────────────── */}
      <div style={{ height: 150, flexShrink: 0, background: '#16171a', padding: '14px 24px', display: 'flex', gap: 26 }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.06em' }}>API 호출 로그 — 시연 오버레이</div>
          {log.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>아직 호출 없음 — 회원 조회부터 눌러보세요.</div>}
          {log.slice(0, 4).map((c) => (
            <div key={c.traceId} className="mono" style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
              <span style={{ color: 'var(--ink-3)', width: 66 }}>{hhmmss(new Date(c.at))}</span>
              <span style={{ color: c.ok ? 'var(--good)' : 'var(--crit)', width: 34, fontWeight: 600 }}>{c.status || 'ERR'}</span>
              <span style={{ color: '#fff', width: 252, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.method} {c.path}</span>
              <span style={{ color: 'var(--ink-3)', width: 168, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.traceId}</span>
              <span style={{ color: c.ms > 300 ? 'var(--crit)' : '#fff' }}>{c.ms} ms</span>
              {c.mocked && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 4, padding: '1px 5px' }}>MOCK</span>}
              {c.error && (
                <span title={c.error} style={{ color: 'var(--warn)', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.error}</span>
              )}
              {c.needsKey && (
                <button onClick={() => setShowKeys(true)} className="chip chip-warn" style={{ cursor: 'pointer' }}>키 설정 열기</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ width: 1, background: 'rgba(255,255,255,.12)' }} />

        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.06em' }}>부하 상태 표시</div>
          <button onClick={toggleLoad} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 52, height: 30, borderRadius: 999, background: loadOn ? meta.brandColor : 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: loadOn ? 'flex-end' : 'flex-start', padding: '0 3px', transition: 'background .15s' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff' }} />
            </span>
            <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{loadOn ? 'k6 러너 실행 중' : 'k6 러너 정지'}</span>
          </button>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {mode === 'mock' ? (
              <>목업 모드에서는 이 토글을 켜면 <strong style={{ color: 'var(--ink-2)' }}>이 테넌트만</strong> 실제로 느려지고 503·429 가 납니다.</>
            ) : (
              <>
                이 토글은 <strong style={{ color: 'var(--ink-2)' }}>표시용</strong>입니다. 실제 부하는 터미널에서:
                <div className="mono" style={{ color: 'var(--ink-2)', marginTop: 4 }}>k6 run k6/k6_1a_cgv_spike.js</div>
              </>
            )}
          </div>
        </div>
      </div>

      {showPointDialog && (
        <PointDialog
          max={usable}
          balance={balance ?? 0}
          initial={appliedPoints}
          onClose={() => setShowPointDialog(false)}
          onConfirm={(v) => { setPointsUsed(v); setShowPointDialog(false); }}
        />
      )}

      {showKeys && <ApiKeyPanel onClose={() => { setShowKeys(false); refreshKeyStatus(); }} />}
    </div>
  );
}

/* ── 포인트 사용 입력 ─────────────────────────────── */

function PointDialog({
  max, balance, initial, onClose, onConfirm,
}: {
  max: number;
  balance: number;
  initial: number;
  onClose: () => void;
  onConfirm: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(initial || ''));
  const value = Math.min(max, Number(raw.replace(/\D/g, '')) || 0);
  const tooMuch = (Number(raw.replace(/\D/g, '')) || 0) > max;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(11,11,11,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, background: '#fff', borderRadius: 16, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 16, color: '#0b0b0b' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--pos-point, #4a3aa7)' }}>CJ ONE 포인트 사용</span>
          <span style={{ flexGrow: 1 }} />
          <button onClick={onClose} style={{ fontSize: 22, lineHeight: 1, color: '#898781' }} aria-label="닫기">×</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#52514e' }}>
          <span>보유 {balance.toLocaleString('ko-KR')}P</span>
          <span>이 거래 최대 {max.toLocaleString('ko-KR')}P</span>
        </div>

        <input
          autoFocus
          className="mono"
          inputMode="numeric"
          value={raw}
          placeholder="0"
          onChange={(e) => setRaw(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && value > 0) onConfirm(value); }}
          style={{
            height: 64, borderRadius: 12, border: `2px solid ${tooMuch ? '#d03b3b' : '#16171a'}`,
            padding: '0 16px', fontSize: 30, fontWeight: 600, textAlign: 'right', outline: 'none', width: '100%',
          }}
        />
        {tooMuch && <div style={{ fontSize: 12, color: '#d03b3b' }}>최대 {max.toLocaleString('ko-KR')}P 까지 사용할 수 있어요 — {max.toLocaleString('ko-KR')}P 로 맞춥니다.</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          {[1000, 5000, 10000].map((v) => (
            <button key={v} className="key key-alt" style={{ flexGrow: 1, height: 44, borderRadius: 9 }} onClick={() => setRaw(String(Math.min(v, max)))}>
              {v.toLocaleString('ko-KR')}
            </button>
          ))}
          <button className="key key-alt" style={{ flexGrow: 1, height: 44, borderRadius: 9 }} onClick={() => setRaw(String(max))}>전액</button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flexGrow: 1, height: 56, borderRadius: 12, background: '#f0efec', color: '#52514e', fontSize: 16, fontWeight: 600 }}
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={value <= 0}
            style={{
              flexGrow: 2, height: 56, borderRadius: 12, fontSize: 17, fontWeight: 700,
              background: value > 0 ? 'var(--pos-point, #4a3aa7)' : '#e6e4df',
              color: value > 0 ? '#fff' : '#898781',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
