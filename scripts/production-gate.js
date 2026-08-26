'use strict';

const { spawn } = require('child_process');
const http = require('http');

const port = Number(process.env.GATE_PORT || 3311);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['-r', './lib/security-hardening.js', 'server.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), SESSION_SECRET: 'production-gate-only-secret', FORCE_HTTPS: 'false' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
child.stdout.on('data', d => { output += d.toString(); });
child.stderr.on('data', d => { output += d.toString(); });

function request(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${base}${pathname}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      await request('/');
      return;
    } catch (_) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`server did not become ready\n${output.slice(-4000)}`);
}

async function main() {
  await waitForServer();

  const home = await request('/');
  if (![200, 304].includes(home.status)) throw new Error(`home returned ${home.status}`);
  if (home.headers['x-content-type-options'] !== 'nosniff') throw new Error('missing nosniff header');
  if (!home.headers['content-security-policy']) throw new Error('missing CSP header');
  if (!home.headers['strict-transport-security']) throw new Error('missing HSTS header');

  const admin = await request('/admin');
  if (![200, 302, 303].includes(admin.status)) throw new Error(`admin boundary returned ${admin.status}`);

  const unauthLms = await request('/api/lms-download?kind=assignment&id=gate-test');
  if (unauthLms.status !== 401) throw new Error(`LMS unauthenticated boundary returned ${unauthLms.status}`);

  const traversal = await request('/uploads/../package.json');
  if (traversal.status !== 404) throw new Error(`uploads traversal boundary returned ${traversal.status}`);

  // Lightweight concurrency gate: 50 workers x 20 requests = 1,000 requests.
  // This catches obvious event-loop, startup and routing regressions without pretending
  // to replace a real production load test against the deployed infrastructure.
  const workers = 50;
  const perWorker = 20;
  let failures = 0;
  const started = Date.now();
  await Promise.all(Array.from({ length: workers }, async () => {
    for (let i = 0; i < perWorker; i++) {
      try {
        const r = await request('/');
        if (![200, 304].includes(r.status)) failures++;
      } catch (_) {
        failures++;
      }
    }
  }));
  const elapsed = Date.now() - started;
  const total = workers * perWorker;
  const failureRate = failures / total;
  if (failureRate > 0.01) throw new Error(`concurrency gate failed: ${failures}/${total} failed (${(failureRate * 100).toFixed(2)}%)`);

  console.log(JSON.stringify({
    gate: 'production',
    passed: true,
    security: ['helmet headers', 'LMS authentication boundary', 'uploads traversal boundary'],
    concurrency: { requests: total, failures, failureRate, elapsedMs: elapsed, requestsPerSecond: Math.round(total / Math.max(elapsed / 1000, 0.001)) }
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || err);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => child.kill('SIGTERM'), 100);
});
