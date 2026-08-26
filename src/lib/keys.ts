import type { TenantKey } from './types';
import { TENANT_ORDER } from './tenants';

/**
 * 키가 있을 수 있는 자리는 두 곳.
 *   1) 개발 서버 — AWS Secrets Manager 에서 읽어 프록시가 헤더에 끼워 넣는다 (브라우저엔 안 내려옴)
 *   2) 브라우저 localStorage — 사람이 직접 붙여넣은 값
 * 둘 다 없으면 요청은 그냥 나가고, 백엔드가 401/403 으로 답한다. 막지 않는다.
 */

const LS_KEY = 'cjone.apiKeys';

export type KeySource = 'aws' | 'env' | 'none';

export interface ServerKeyStatus {
  source: KeySource;
  tenants: Record<string, boolean>;
  message?: string;
  hint?: string;
}

export function readLocalKeys(): Partial<Record<TenantKey, string>> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Record<TenantKey, string>>) : {};
  } catch {
    return {};
  }
}

export function writeLocalKeys(next: Partial<Record<TenantKey, string>>) {
  try {
    const clean: Partial<Record<TenantKey, string>> = {};
    for (const t of TENANT_ORDER) {
      const v = next[t]?.trim();
      if (v) clean[t] = v;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('cjone:keys'));
  } catch {
    /* 시크릿 창 등 — 저장 못 해도 화면은 계속 돈다 */
  }
}

export function clearLocalKeys() {
  try {
    localStorage.removeItem(LS_KEY);
    window.dispatchEvent(new CustomEvent('cjone:keys'));
  } catch {
    /* noop */
  }
}

function envKey(tenant: TenantKey): string {
  const v = import.meta.env[`VITE_${tenant.toUpperCase()}_KEY`] as string | undefined;
  return v ?? '';
}

/** 브라우저가 직접 실어 보낼 키. 없으면 빈 문자열 — 그러면 프록시가 채워준다. */
export function browserKey(tenant: TenantKey): string {
  return readLocalKeys()[tenant] || envKey(tenant);
}

export async function fetchServerKeyStatus(): Promise<ServerKeyStatus | null> {
  try {
    const res = await fetch('/__dev/keys');
    if (!res.ok) return null;
    return (await res.json()) as ServerKeyStatus;
  } catch {
    return null;
  }
}

export async function reloadServerKeys(): Promise<ServerKeyStatus | null> {
  try {
    const res = await fetch('/__dev/keys?reload=1', { method: 'POST' });
    if (!res.ok) return null;
    return (await res.json()) as ServerKeyStatus;
  } catch {
    return null;
  }
}

/** 이 테넌트로 지금 호출이 될 상태인가 */
export function keyReady(tenant: TenantKey, server: ServerKeyStatus | null): boolean {
  return Boolean(browserKey(tenant)) || Boolean(server?.tenants?.[tenant]);
}
