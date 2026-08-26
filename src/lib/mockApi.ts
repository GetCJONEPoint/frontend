import { TENANTS } from './tenants';
import type { ApiOp, TenantKey } from './types';

/**
 * 백엔드 없이 도는 가짜 membership-api.
 *
 * 그냥 성공만 돌려주면 시연이 안 된다 — 핵심은 **부하 상태에 따라 응답이 달라지는 것**이다.
 * POS 의 부하 토글을 켠 테넌트만 느려지고 실패하고, 나머지는 그대로 빠르다.
 * 그게 곧 격리 주장의 장면이다.
 */

const LS_BAL = 'cjone.mockBalances';
const hot = new Set<TenantKey>();

export function setMockLoad(tenant: TenantKey, on: boolean) {
  if (on) hot.add(tenant);
  else hot.delete(tenant);
}

export function isMockHot(tenant: TenantKey): boolean {
  return hot.has(tenant);
}

function readBalances(): Partial<Record<TenantKey, number>> {
  try {
    const raw = localStorage.getItem(LS_BAL);
    return raw ? (JSON.parse(raw) as Partial<Record<TenantKey, number>>) : {};
  } catch {
    return {};
  }
}

function writeBalances(next: Partial<Record<TenantKey, number>>) {
  try {
    localStorage.setItem(LS_BAL, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function resetMockBalances() {
  try {
    localStorage.removeItem(LS_BAL);
  } catch {
    /* noop */
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface MockResult {
  status: number;
  ok: boolean;
  ms: number;
  body: unknown;
}

export async function mockCall(tenant: TenantKey, op: ApiOp, amount = 0): Promise<MockResult> {
  const isHot = hot.has(tenant);

  // 평상시 28~62ms, 폭주 중이면 620~880ms — 사람이 체감할 수 있는 차이
  const ms = Math.round(isHot ? 620 + Math.random() * 260 : 28 + Math.random() * 34);
  await sleep(ms);

  if (isHot) {
    const roll = Math.random();
    if (roll < 0.28) {
      return { status: 503, ok: false, ms, body: { message: 'upstream saturated — connection pool exhausted' } };
    }
    if (roll < 0.44) {
      return { status: 429, ok: false, ms, body: { message: 'tenant quota exceeded' } };
    }
  }

  const meta = TENANTS[tenant];
  const store = readBalances();
  const current = store[tenant] ?? meta.seedBalance;

  if (op === 'balance') {
    writeBalances({ ...store, [tenant]: current });
    return {
      status: 200, ok: true, ms,
      body: { memberId: meta.memberId, balance: current, expiringSoon: 320, expiringAt: '2026-09-30' },
    };
  }

  if (op === 'earn') {
    const next = current + amount;
    writeBalances({ ...store, [tenant]: next });
    return { status: 201, ok: true, ms, body: { memberId: meta.memberId, earned: amount, balance: next } };
  }

  // use
  if (current < amount) {
    return { status: 409, ok: false, ms, body: { message: `insufficient balance (${current} < ${amount})` } };
  }
  const next = current - amount;
  writeBalances({ ...store, [tenant]: next });
  return { status: 200, ok: true, ms, body: { memberId: meta.memberId, used: amount, balance: next } };
}
