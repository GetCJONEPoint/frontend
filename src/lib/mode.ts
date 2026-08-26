export type ApiMode = 'mock' | 'live';

const LS_KEY = 'cjone.apiMode';

/**
 * 백엔드가 아직 안 붙어 있어서 기본값은 mock 이다.
 * 붙고 나면 화면에서 'live' 로 바꾸면 되고, 코드는 안 건드려도 된다.
 */
export function getApiMode(): ApiMode {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === 'live' || v === 'mock') return v;
  } catch {
    /* noop */
  }
  return (import.meta.env.VITE_API_MODE as string) === 'live' ? 'live' : 'mock';
}

export function setApiMode(mode: ApiMode) {
  try {
    localStorage.setItem(LS_KEY, mode);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent('cjone:mode'));
}
