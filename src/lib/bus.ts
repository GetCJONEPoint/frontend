import { useEffect, useRef } from 'react';
import type { PosCall, TenantKey } from './types';

/**
 * 창끼리 잇는 선. POS 창에서 누른 요청이 콘솔 창에 그대로 뜬다.
 * 같은 origin 의 다른 탭/창이면 자동으로 붙는다 (별도 서버 불필요).
 */
export type BusMessage =
  | { type: 'pos-call'; call: PosCall }
  | { type: 'load'; tenant: TenantKey; on: boolean; rps: number }
  | { type: 'replay'; action: 'play' | 'pause' | 'seek'; t?: number }
  | { type: 'ping' };

const CHANNEL = 'cjone-demo';

export function publish(msg: BusMessage) {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage(msg);
  ch.close();
}

export function useBus(onMessage: (msg: BusMessage) => void) {
  const ref = useRef(onMessage);
  ref.current = onMessage;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent<BusMessage>) => ref.current(e.data);
    return () => ch.close();
  }, []);
}
