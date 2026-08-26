import type { ApiOp, Balance, PosCall, TenantKey } from './types';
import { TENANTS } from './tenants';
import { browserKey } from './keys';
import { getApiMode } from './mode';
import { mockCall } from './mockApi';

/** vite dev 프록시를 탄다. 브라우저 → /api → API Gateway (키는 프록시가 끼워 넣음) */
const BASE = '/api';

/**
 * POS 클릭 한 건과 콘솔 화면의 한 점을 잇는 끈.
 * 백엔드가 이 헤더를 안 봐도 상관없다 — 두 창이 같은 값을 보여주는 것만으로
 * "지금 누른 이 요청이 저기 저 이벤트"라고 말할 근거가 된다.
 */
export function newTraceId(tenant: TenantKey, op: ApiOp): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${tenant}-${op}-${Date.now().toString(36)}-${rand}`;
}

function headers(tenant: TenantKey, traceId: string, extra?: Record<string, string>) {
  const h: Record<string, string> = {
    'content-type': 'application/json',
    'x-tenant-id': TENANTS[tenant].tenantId,
    'x-trace-id': traceId,
    ...extra,
  };
  // 브라우저에 직접 넣어둔 키가 있을 때만 실어 보낸다.
  // 없으면 헤더를 비워 보내고, 개발 서버 프록시가 대신 채운다.
  const k = browserKey(tenant);
  if (k) h['x-api-key'] = k;
  return h;
}

interface CallResult {
  call: PosCall;
  body: unknown;
}

async function run(
  tenant: TenantKey,
  op: ApiOp,
  method: 'GET' | 'POST',
  path: string,
  init?: RequestInit,
  amount = 0,
): Promise<CallResult> {
  const traceId = newTraceId(tenant, op);
  const started = performance.now();

  // 백엔드가 아직 없을 때 — 가짜 응답으로 흐름을 끝까지 돌린다
  if (getApiMode() === 'mock') {
    const m = await mockCall(tenant, op, amount);
    return {
      call: {
        traceId, tenant, op, method, path,
        status: m.status,
        ok: m.ok,
        ms: m.ms,
        at: Date.now(),
        error: m.ok ? undefined : `${describe(m.status)}${serverSaid(m.body)}`,
        mocked: true,
      },
      body: m.body,
    };
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      method,
      headers: headers(tenant, traceId, init?.headers as Record<string, string>),
    });
    const ms = Math.round(performance.now() - started);

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return {
      call: {
        traceId, tenant, op, method, path,
        status: res.status,
        ok: res.ok,
        ms,
        at: Date.now(),
        error: res.ok ? undefined : `${describe(res.status)}${serverSaid(body)}`,
        needsKey: res.status === 401 || res.status === 403,
      },
      body,
    };
  } catch (e) {
    return {
      call: {
        traceId, tenant, op, method, path,
        status: 0,
        ok: false,
        ms: Math.round(performance.now() - started),
        at: Date.now(),
        error: e instanceof Error ? e.message : '네트워크 오류',
      },
      body: null,
    };
  }
}

/** 백엔드가 뭐라고 했는지 그대로 노출한다 — 이게 없으면 500 이 왜 났는지 알 길이 없다 */
function serverSaid(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  const msg = b.message ?? b.error ?? b.detail ?? b.errorMessage ?? b.code;
  if (msg === undefined || msg === null) return '';
  return ` · ${String(msg).slice(0, 160)}`;
}

function describe(status: number): string {
  if (status === 401 || status === 403) return 'API 키 없음/불일치 — 키 설정을 열어보세요';
  if (status === 429) return '레이트리밋 — 테넌트 쿼터 초과';
  if (status === 409) return '잔액 부족 / 중복 요청';
  if (status === 400) return '요청 값 오류';
  if (status === 503) return '업스트림 포화';
  if (status >= 500) return '서버 오류';
  return `HTTP ${status}`;
}

export async function fetchBalance(tenant: TenantKey) {
  const { memberId } = TENANTS[tenant];
  const r = await run(tenant, 'balance', 'GET', `/v1/members/${memberId}/balance`);
  const b = r.body as Partial<Balance> | null;
  const balance = typeof b?.balance === 'number' ? b.balance : undefined;
  return { call: { ...r.call, balanceAfter: balance }, balance: b };
}

export async function postEarn(tenant: TenantKey, amount: number) {
  const { memberId } = TENANTS[tenant];
  return run(tenant, 'earn', 'POST', '/v1/points/earn', {
    headers: { 'idempotency-key': newTraceId(tenant, 'earn') },
    body: JSON.stringify({ memberId, amount, channel: 'ONLINE' }),
  }, amount);
}

export async function postUse(tenant: TenantKey, amount: number) {
  const { memberId } = TENANTS[tenant];
  return run(tenant, 'use', 'POST', '/v1/points/use', {
    headers: { 'idempotency-key': newTraceId(tenant, 'use') },
    body: JSON.stringify({ memberId, amount, channel: 'ONLINE' }),
  }, amount);
}
