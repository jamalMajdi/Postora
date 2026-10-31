#!/usr/bin/env node
/**
 * تشغيل بيئة التطوير كاملة:
 *   - خادم تلجرام وهمي (اختياري، عند FAKE_TELEGRAM=1)
 *   - خادم Postora (Express + Bot)
 *   - Mini App (Vite dev server)
 *
 * الاستخدام:  npm run dev
 *            FAKE_TELEGRAM=1 npm run dev   ← بلا توكن حقيقي (اختبار محلي كامل)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const children = [];
let shuttingDown = false;

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...options.env },
    shell: process.platform === 'win32'
  });

  const prefix = `[${name}]`;
  child.stdout.on('data', (data) => process.stdout.write(`${prefix} ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`${prefix} ${data}`));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${prefix} exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[dev] stopping all processes…');
  for (const child of children) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const useFakeTelegram = process.env.FAKE_TELEGRAM === '1';

let fakePort = null;

if (useFakeTelegram) {
  // نبدأ الخادم الوهمي أولًا ثم نمرر عنوانه للخادم
  const fake = run(
    'fake-tg',
    process.execPath,
    [path.join(ROOT, 'scripts', 'fake-telegram-server.js')],
    { env: { FAKE_TG_PORT: process.env.FAKE_TG_PORT || '8081' } }
  );

  fake.stdout.on('data', (data) => {
    const text = String(data);
    const match = /listening on (http:\/\/\S+)/.exec(text);
    if (match && !fakePort) {
      fakePort = match[1];
    }
  });

  // انتظار قصير حتى يقلع الخادم الوهمي
  setTimeout(startServer, 700);
} else {
  startServer();
}

function startServer() {
  const serverEnv = { ...process.env };
  if (useFakeTelegram) {
    serverEnv.TELEGRAM_API_BASE_URL =
      fakePort || `http://127.0.0.1:${process.env.FAKE_TG_PORT || 8081}`;
    console.log(`[dev] using fake Telegram API at ${serverEnv.TELEGRAM_API_BASE_URL}`);
  }

  run('server', process.execPath, ['--watch', 'src/index.js'], {
    cwd: path.join(ROOT, 'apps', 'server'),
    env: serverEnv
  });

  run('miniapp', 'npm', ['run', 'dev', '--workspace', '@postora/miniapp'], {
    cwd: ROOT,
    env: { ...process.env, VITE_API_TARGET: 'http://127.0.0.1:3000' }
  });
}
