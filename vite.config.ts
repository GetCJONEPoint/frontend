import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';

const pexec = promisify(execFile);

type Keys = Record<string, string>;
interface KeyState {
  source: 'aws' | 'env' | 'none';
  keys: Keys;
  message?: string;
  hint?: string;
}

const REGION = 'ap-northeast-2';
const SECRET_ID = 'cjone/tenant/api-keys';
const TENANTS = ['cgv', 'cjenm', 'oliveyoung', 'vips'];

/**
 * 개발 서버가 대신 키를 들고 있는다.
 * 브라우저에는 키가 안 내려가고, 프록시가 x-tenant-id 를 보고 x-api-key 를 끼워 넣는다.
 * 이렇게 하면 프론트에서는 .env.local 을 건드릴 필요가 없다.
 */
async function readFromAws(env: Record<string, string>): Promise<KeyState> {
  const profile = env.AWS_PROFILE || process.env.AWS_PROFILE || 'capstone-terraform';
  try {
    const { stdout } = await pexec(
      'aws',
      [
        'secretsmanager', 'get-secret-value',
        '--region', REGION,
        '--secret-id', SECRET_ID,
        '--query', 'SecretString',
        '--output', 'text',
      ],
      { env: { ...process.env, AWS_PROFILE: profile }, timeout: 20_000 },
    );
    const parsed = JSON.parse(stdout.trim()) as Keys;
    const keys: Keys = {};
    for (const t of TENANTS) if (parsed[t]) keys[t] = parsed[t];
    return { source: 'aws', keys };
  } catch (e) {
    const err = e as { stderr?: string; message?: string; code?: string };
    const raw = (err.stderr || err.message || '').trim();
    let hint = `직접 확인: AWS_PROFILE=${profile} aws secretsmanager get-secret-value --region ${REGION} --secret-id ${SECRET_ID}`;
    if (err.code === 'ENOENT') hint = 'aws CLI 가 설치돼 있지 않습니다 (brew install awscli).';
    else if (/sso|expired|token/i.test(raw)) hint = `SSO 세션이 만료됐습니다: aws sso login --profile ${profile}`;
    return { source: 'none', keys: {}, message: raw.split('\n')[0] || '알 수 없는 오류', hint };
  }
}

function fromEnv(env: Record<string, string>): Keys {
  const keys: Keys = {};
  for (const t of TENANTS) {
    const v = env[`VITE_${t.toUpperCase()}_KEY`];
    if (v) keys[t] = v;
  }
  return keys;
}

function devKeysPlugin(env: Record<string, string>, state: { current: KeyState | null }): Plugin {
  async function ensure(force = false): Promise<KeyState> {
    if (state.current && !force) return state.current;
    const envKeys = fromEnv(env);
    if (Object.keys(envKeys).length === TENANTS.length) {
      state.current = { source: 'env', keys: envKeys };
      return state.current;
    }
    const aws = await readFromAws(env);
    if (aws.source === 'aws') {
      state.current = { source: 'aws', keys: { ...envKeys, ...aws.keys } };
    } else if (Object.keys(envKeys).length > 0) {
      state.current = { source: 'env', keys: envKeys };
    } else {
      state.current = aws;
    }
    return state.current;
  }

  return {
    name: 'cjone-dev-keys',
    apply: 'serve',
    configureServer(server) {
      void ensure();

      server.middlewares.use('/__dev/keys', (req, res) => {
        const force = req.method === 'POST' || (req.url ?? '').includes('reload');
        ensure(force).then((s) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              source: s.source,
              tenants: Object.fromEntries(TENANTS.map((t) => [t, Boolean(s.keys[t])])),
              message: s.message,
              hint: s.hint,
            }),
          );
        });
      });
    },
    config() {
      return {
        server: {
          proxy: {
            '/api': {
              target:
                env.VITE_API_BASE_URL ||
                'https://r0swh7n17i.execute-api.ap-northeast-2.amazonaws.com',
              changeOrigin: true,
              secure: true,
              rewrite: (p: string) => p.replace(/^\/api/, ''),
              configure(proxy: any) {
                proxy.on('proxyReq', (proxyReq: any, req: IncomingMessage) => {
                  const tenant = String(req.headers['x-tenant-id'] ?? '-');
                  let how = 'none';
                  if (req.headers['x-api-key']) {
                    how = 'browser'; // 수동 입력분 — 그대로 둔다
                  } else {
                    const key = state.current?.keys[tenant];
                    if (key) {
                      proxyReq.setHeader('x-api-key', key);
                      how = `server(${state.current?.source})`;
                    }
                  }
                  (req as any).__key = how;
                });
                proxy.on('proxyRes', (proxyRes: any, req: IncomingMessage) => {
                  const tenant = String(req.headers['x-tenant-id'] ?? '-');
                  console.log(
                    `[api] ${req.method} ${req.url} -> ${proxyRes.statusCode}` +
                      `  tenant=${tenant} key=${(req as any).__key}`,
                  );
                  const ct = String(proxyRes.headers['content-type'] ?? '');
                  if (Number(proxyRes.statusCode) >= 400 && ct.includes('json')) {
                    let buf = '';
                    proxyRes.on('data', (c: Buffer) => { if (buf.length < 800) buf += c.toString(); });
                    proxyRes.on('end', () => console.log(`[api]   body: ${buf.slice(0, 400)}`));
                  }
                });
                proxy.on('error', (err: Error) => console.log(`[api] proxy error: ${err.message}`));
              },
            },
          },
        },
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const state: { current: KeyState | null } = { current: null };
  return {
    plugins: [react(), devKeysPlugin(env, state)],
    server: { port: 5173 },
  };
});
