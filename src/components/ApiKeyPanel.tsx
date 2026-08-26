import { useEffect, useState } from 'react';
import { TENANTS, TENANT_ORDER } from '../lib/tenants';
import type { TenantKey } from '../lib/types';
import { getApiMode, setApiMode, type ApiMode } from '../lib/mode';
import { resetMockBalances } from '../lib/mockApi';
import {
  clearLocalKeys,
  fetchServerKeyStatus,
  readLocalKeys,
  reloadServerKeys,
  writeLocalKeys,
  type ServerKeyStatus,
} from '../lib/keys';

const SOURCE_LABEL: Record<string, string> = {
  aws: 'AWS Secrets Manager 에서 읽음',
  env: '.env.local 에서 읽음',
  none: '개발 서버가 키를 못 가져왔음',
};

export default function ApiKeyPanel({ onClose }: { onClose: () => void }) {
  const [server, setServer] = useState<ServerKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Partial<Record<TenantKey, string>>>(() => readLocalKeys());
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<ApiMode>(getApiMode);

  function pickMode(next: ApiMode) {
    setMode(next);
    setApiMode(next);
  }

  useEffect(() => {
    fetchServerKeyStatus().then((s) => {
      setServer(s);
      setLoading(false);
    });
  }, []);

  async function reload() {
    setLoading(true);
    setServer(await reloadServerKeys());
    setLoading(false);
  }

  function save() {
    writeLocalKeys(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  const okCount = server ? Object.values(server.tenants).filter(Boolean).length : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: 620, maxHeight: '86vh', overflowY: 'auto', background: 'var(--surface)',
          padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>연결 설정</span>
          <span style={{ flexGrow: 1 }} />
          <button onClick={onClose} style={{ color: 'var(--ink-3)', fontSize: 20, lineHeight: 1 }} aria-label="닫기">
            ×
          </button>
        </div>

        {/* ⓪ 어디에 대고 부를 것인가 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>어디에 대고 부를까요</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { v: 'mock' as ApiMode, t: '목업', d: '백엔드 없이 프론트만으로 전부 동작' },
              { v: 'live' as ApiMode, t: '실서버', d: 'API Gateway 로 실제 호출' },
            ]).map((o) => (
              <button
                key={o.v}
                onClick={() => pickMode(o.v)}
                style={{
                  flexGrow: 1, textAlign: 'left', borderRadius: 10, padding: '13px 15px',
                  background: mode === o.v ? 'rgba(57,135,229,.12)' : 'var(--surface-2)',
                  border: mode === o.v ? '1.5px solid var(--t-cgv)' : '1px solid var(--hair)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: mode === o.v ? 'var(--ink)' : 'var(--ink-2)' }}>
                  {o.t}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{o.d}</div>
              </button>
            ))}
          </div>
          {mode === 'mock' ? (
            <div style={{ background: 'rgba(250,178,25,.09)', border: '1px solid rgba(250,178,25,.32)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.75 }}>
              지금은 <strong style={{ color: 'var(--warn)' }}>목업</strong>입니다. API 키가 필요 없고, 아래 설정도 안 봐도 됩니다.<br />
              적립·사용·조회가 다 되고 잔액도 실제로 오르내립니다. POS 하단의 <strong style={{ color: 'var(--ink) ' }}>부하 토글</strong>을 켜면
              그 테넌트만 620~880ms 로 느려지고 503·429 가 섞여 나옵니다 — 다른 POS 창은 그대로 빠릅니다.
              <div style={{ marginTop: 9 }}>
                <button
                  onClick={resetMockBalances}
                  style={{ background: 'var(--hair)', color: 'var(--ink-2)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                >
                  잔액 초기화
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              실서버로 부릅니다. 백엔드가 아직 안 붙어 있으면 500 이 납니다 — 그건 정상입니다.
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--hair)' }} />

        {/* ① 개발 서버가 대신 들고 있는 키 */}
        <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 12, opacity: mode === 'mock' ? 0.45 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>1. 개발 서버가 자동으로 붙여줌</span>
            <span style={{ flexGrow: 1 }} />
            {loading ? (
              <span className="chip chip-warn pulse">확인 중</span>
            ) : okCount === TENANT_ORDER.length ? (
              <span className="chip chip-good">4/4 준비됨</span>
            ) : okCount > 0 ? (
              <span className="chip chip-warn">{okCount}/4</span>
            ) : (
              <span className="chip chip-crit">없음</span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            개발 서버가 Secrets Manager에서 키를 읽어 프록시 단계에서 <span className="mono">x-api-key</span> 를 끼워 넣습니다.
            이게 되면 브라우저는 키를 몰라도 되고, 아무것도 안 해도 버튼이 그냥 동작합니다.
          </p>

          {server && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{SOURCE_LABEL[server.source] ?? server.source}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TENANT_ORDER.map((t) => (
                  <span
                    key={t}
                    className="mono"
                    style={{
                      fontSize: 11, padding: '4px 9px', borderRadius: 6,
                      background: server.tenants[t] ? 'rgba(12,163,12,.14)' : 'var(--hair)',
                      color: server.tenants[t] ? 'var(--good)' : 'var(--ink-3)',
                    }}
                  >
                    {t} {server.tenants[t] ? '✓' : '—'}
                  </span>
                ))}
              </div>
              {server.message && (
                <div style={{ fontSize: 12, color: 'var(--crit)', marginTop: 2 }}>{server.message}</div>
              )}
              {server.hint && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', background: 'var(--bg)', borderRadius: 7, padding: '9px 11px', lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {server.hint}
                </div>
              )}
            </div>
          )}

          <button
            onClick={reload}
            disabled={loading}
            style={{ alignSelf: 'flex-start', background: 'var(--t-cgv)', color: '#0d0d0d', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 700 }}
          >
            {loading ? '불러오는 중…' : '키 다시 불러오기'}
          </button>
        </div>

        {/* ② 직접 붙여넣기 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: mode === 'mock' ? 0.45 : 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>2. 직접 붙여넣기</div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.7 }}>
            위가 안 되면 여기에 넣으세요. 이 브라우저에만 저장되고 요청 헤더로 나갑니다. 서버 쪽 키보다 우선합니다.
          </p>

          {TENANT_ORDER.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: TENANTS[t].color, flexShrink: 0 }} />
              <span className="mono" style={{ width: 88, fontSize: 12, color: 'var(--ink-2)' }}>{t}</span>
              <input
                className="mono"
                type="password"
                value={draft[t] ?? ''}
                placeholder="비워두면 서버 키를 씁니다"
                onChange={(e) => setDraft((d) => ({ ...d, [t]: e.target.value }))}
                style={{
                  flexGrow: 1, height: 38, borderRadius: 8, border: '1px solid var(--hair)',
                  background: 'var(--surface-2)', color: 'var(--ink)', padding: '0 11px', fontSize: 12, outline: 'none',
                }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ background: 'var(--ink)', color: 'var(--bg)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 700 }}>
              {saved ? '저장됨 ✓' : '저장'}
            </button>
            <button
              onClick={() => { clearLocalKeys(); setDraft({}); }}
              style={{ background: 'var(--hair)', color: 'var(--ink-2)', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600 }}
            >
              브라우저 키 지우기
            </button>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7, borderTop: '1px solid var(--hair)', paddingTop: 13 }}>
          아래 1·2번은 <strong>실서버 모드에서만</strong> 의미가 있습니다. 백엔드가 붙기 전까지는 목업 그대로 쓰세요.
          어느 모드든 버튼은 항상 눌리고, 실패해도 응답이 로그에 그대로 찍힙니다.
        </div>
      </div>
    </div>
  );
}
