import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 리플레이 시계.
 * 에이전트 반응은 4초, POS 클릭은 1초, 부하 램프는 2분 — 시간 축이 안 맞는다.
 * 그래서 실시간 스트림 대신, 끝난 run 을 진행자가 되감아 재생한다.
 */
export function useReplay(durationMs: number) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (!playing) return;

    // 이전 프레임 시각은 이 effect 안에서만 산다.
    // ref 로 공유하면 StrictMode 이중 실행 때 두 루프가 서로의 값을 덮어써서
    // dt 가 음수가 되고 t 가 뒤로 간다 (실제로 화면이 터졌던 원인).
    let raf = 0;
    let prevNow = performance.now();

    const tick = (now: number) => {
      const dt = Math.max(0, now - prevNow) * speedRef.current;
      prevNow = now;
      setT((prev) => Math.min(durationMs, Math.max(0, prev + dt)));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationMs]);

  // 끝에 닿으면 멈춘다 — 업데이터 안에서 setState 하지 않는다
  useEffect(() => {
    if (playing && t >= durationMs) setPlaying(false);
  }, [t, playing, durationMs]);

  const play = useCallback(() => {
    setT((prev) => (prev >= durationMs ? 0 : prev));
    setPlaying(true);
  }, [durationMs]);

  const pause = useCallback(() => setPlaying(false), []);
  const seek = useCallback(
    (ms: number) => setT(Math.min(durationMs, Math.max(0, Number.isFinite(ms) ? ms : 0))),
    [durationMs],
  );
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  return { t, playing, speed, setSpeed, play, pause, toggle, seek };
}
