import { useEffect, useState } from 'react';
import { TENANTS } from '../lib/tenants';
import { fetchServerKeyStatus, keyReady, type ServerKeyStatus } from '../lib/keys';
import { getApiMode } from '../lib/mode';
import ApiKeyPanel from '../components/ApiKeyPanel';

function open(path: string, w: number, h: number) {
  window.open(path, '_blank', `width=${w},height=${h}`);
}

export default function Launcher() {
  const [showKeys, setShowKeys] = useState(false);
  const [server, setServer] = useState<ServerKeyStatus | null>(null);

  const [mode, setMode] = useState(getApiMode);

  const refresh = () => { void fetchServerKeyStatus().then(setServer); };
  useEffect(() => {
    refresh();
    const onMode = () => setMode(getApiMode());
    window.addEventListener('cjone:mode', onMode);
    return () => window.removeEventListener('cjone:mode', onMode);
  }, []);

  const ready = mode === 'mock' || keyReady('cgv', server);

  return (
    <div style={{ minHeight: '100%', padding: '48px 40px', maxWidth: 760, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>CJ ONE 시연 화면</h1>
      <p style={{ color: 'var(--ink-3)', fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
        두 창을 따로 띄워 나란히 놓고 녹화하세요. POS에서 누른 요청은 콘솔 창에 그대로 뜹니다.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap' }}>
        <button
          className="card"
          style={{ padding: '16px 20px', textAlign: 'left', minWidth: 260 }}
          onClick={() => open('/?view=console', 1600, 950)}
        >
          <div style={{ fontWeight: 600, fontSize: 15 }}>에이전트 실행 콘솔</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>
            쿼터 재분배 → 이상탐지 → 진단 · 리플레이
          </div>
        </button>

        <button
          className="card"
          style={{ padding: '16px 20px', textAlign: 'left', minWidth: 260 }}
          onClick={() => open('/?view=pos&tenant=cgv', 1290, 850)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: TENANTS.cgv.color }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>CGV POS 단말</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>{TENANTS.cgv.storeName}</div>
        </button>
      </div>

      <div style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setShowKeys(true)}
          className={mode === 'mock' ? 'chip chip-warn' : ready ? 'chip chip-good' : 'chip chip-crit'}
          style={{ cursor: 'pointer', padding: '7px 13px', fontSize: 12 }}
        >
          {mode === 'mock' ? '목업 모드 · 연결 설정' : ready ? '실서버 연결됨 · 설정' : 'API 키 설정 필요'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {mode === 'mock'
            ? '백엔드 없이 전부 동작합니다. 붙으면 여기서 실서버로 바꾸세요.'
            : '콘솔은 키 없이도 동작합니다. POS 호출만 키가 필요해요.'}
        </span>
      </div>

      {showKeys && <ApiKeyPanel onClose={() => { setShowKeys(false); refresh(); }} />}
    </div>
  );
}
