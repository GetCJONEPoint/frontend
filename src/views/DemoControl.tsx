import { useState } from 'react';
import { publish } from '../lib/bus';

interface Step {
  n: number;
  title: string;
  body: string;
  cmd: string | null;
  seek?: number;
}

const STEPS: Step[] = [
  {
    n: 1,
    title: '평상 운영',
    body: 'POS 두 창(CGV · 올리브영)에서 각각 회원 조회 → 적립. 양쪽 다 정상 응답인 것을 보여준다.',
    cmd: null,
  },
  {
    n: 2,
    title: 'CGV 폭주 시작',
    body: 'k6 를 띄우고, CGV POS 창의 부하 표시 토글을 켠다. 콘솔 리플레이가 자동으로 재생된다.',
    cmd: 'k6 run k6/k6_1a_cgv_spike.js',
  },
  {
    n: 3,
    title: '이웃 무영향 확인',
    body: 'CGV POS 는 실패/지연, 올리브영 POS 는 그대로 성공. 이 대비가 격리 주장의 전부다.',
    cmd: null,
  },
  {
    n: 4,
    title: '쿼터 재분배 에이전트',
    body: '콘솔 리플레이를 +34s 근처로 이동. 트리거 → 관측 → 판단 → 조치 → 검증을 0.5× 로 천천히.',
    cmd: null,
    seek: 30_000,
  },
  {
    n: 5,
    title: '이상탐지 · 진단',
    body: '+46s 이상탐지 알람, +84s SLO 위반. "위반 38초 전에 먼저 떴다"를 짚고, 근본원인·권고까지.',
    cmd: null,
    seek: 44_000,
  },
];

export default function DemoControl() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(cmd: string) {
    navigator.clipboard?.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div style={{ minHeight: '100%', padding: '28px 26px' }}>
      <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>진행자 패널</h1>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.7 }}>
        이 창은 <strong style={{ color: 'var(--warn)' }}>녹화 화면에 넣지 마세요.</strong> 운영자 UI가 아니라
        시연 진행용입니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        {STEPS.map((s) => (
          <div key={s.n} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
            <span
              className="mono"
              style={{
                width: 24, height: 24, borderRadius: '50%', background: 'var(--hair)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}
            >
              {s.n}
            </span>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.65 }}>{s.body}</div>
              {s.cmd && (
                <button
                  onClick={() => copy(s.cmd!)}
                  className="mono"
                  style={{
                    marginTop: 9, width: '100%', textAlign: 'left', background: 'var(--surface-2)',
                    border: '1px solid var(--hair)', borderRadius: 8, padding: '9px 11px',
                    fontSize: 12, color: 'var(--ink-2)',
                  }}
                >
                  {copied === s.cmd ? '복사됨 ✓' : s.cmd}
                </button>
              )}
              {s.seek !== undefined && (
                <button
                  onClick={() => publish({ type: 'replay', action: 'seek', t: s.seek })}
                  style={{
                    marginTop: 9, background: 'var(--t-cgv)', color: '#0d0d0d',
                    borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700,
                  }}
                >
                  콘솔 리플레이 {(s.seek! / 1000).toFixed(0)}s 로 이동
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
