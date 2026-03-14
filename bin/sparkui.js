#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const command = args[0];

// Resolve the package root (where server.js lives)
const PKG_ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

/**
 * Load .env from a given directory into an object (does NOT modify process.env).
 */
function loadEnvFile(dir) {
  const envPath = path.join(dir, '.env');
  const vars = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return vars;
}

/**
 * Resolve config: CWD .env > PKG_ROOT .env > defaults
 */
function resolveConfig() {
  const cwdEnv = loadEnvFile(process.cwd());
  const pkgEnv = loadEnvFile(PKG_ROOT);
  const env = { ...pkgEnv, ...cwdEnv };

  // CLI overrides
  const portOverride = getArg('--port');
  if (portOverride) env.SPARKUI_PORT = portOverride;

  return {
    port: parseInt(env.SPARKUI_PORT, 10) || 3457,
    pushToken: env.PUSH_TOKEN || '',
    baseUrl: env.SPARKUI_BASE_URL || `http://localhost:${parseInt(env.SPARKUI_PORT, 10) || 3457}`,
    envFile: fs.existsSync(path.join(process.cwd(), '.env'))
      ? path.join(process.cwd(), '.env')
      : fs.existsSync(path.join(PKG_ROOT, '.env'))
        ? path.join(PKG_ROOT, '.env')
        : null,
  };
}

function usage() {
  console.log(`
⚡ SparkUI CLI

Usage:
  sparkui init                                Initialize SparkUI in current directory
  sparkui start [--port <port>]               Start the SparkUI server
  sparkui stop                                Stop the SparkUI server
  sparkui push --html <file>                  Push raw HTML
  sparkui push --template <name> --data <json> Push from template
  sparkui update <id> --html <file>           Update a page
  sparkui delete <id>                         Delete a page
  sparkui status                              Check server health

Options:
  --port <port>   Override server port (start command)
  --ttl <seconds> Page TTL (default: 3600)
  --token <token> Push token (or set PUSH_TOKEN env)

Environment:
  SPARKUI_URL    Server base URL (default: http://localhost:3457)
  PUSH_TOKEN     Authentication token
`);
}

// ── Init Command ─────────────────────────────────────────────────────────────

function cmdInit() {
  const cwd = process.cwd();
  const envDest = path.join(cwd, '.env');

  // Check if .env already exists
  if (fs.existsSync(envDest)) {
    console.log('⚠️  .env already exists in this directory. Skipping init.');
    console.log('   Delete it first if you want to re-initialize.');
    process.exit(0);
  }

  // Read .env.example from the package
  const examplePath = path.join(PKG_ROOT, '.env.example');
  if (!fs.existsSync(examplePath)) {
    console.error('Error: .env.example not found in package. Something is wrong with the installation.');
    process.exit(1);
  }

  let envContent = fs.readFileSync(examplePath, 'utf-8');

  // Generate a random push token
  const token = 'spk_' + crypto.randomBytes(24).toString('hex');
  envContent = envContent.replace('your-random-token-here', token);

  // Write .env
  fs.writeFileSync(envDest, envContent);

  console.log(`
⚡ SparkUI initialized!

  📁 Config: ${envDest}
  🔑 Push token: ${token.slice(0, 12)}...${token.slice(-4)}
  🌐 Port: 3457
  🔗 Base URL: http://localhost:3457

Next steps:
  1. Review .env and adjust settings if needed
  2. Run: sparkui start
  3. Push a page:
     curl -X POST http://localhost:3457/api/push \\
       -H "Authorization: Bearer ${token}" \\
       -H "Content-Type: application/json" \\
       -d '{"template":"feedback-form","data":{"title":"Hello SparkUI!"}}'
`);
}

// ── Start Command ────────────────────────────────────────────────────────────

function cmdStart() {
  const config = resolveConfig();
  const pidFile = path.join(process.cwd(), '.sparkui.pid');

  // Check if already running
  if (fs.existsSync(pidFile)) {
    const existingPid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    try {
      process.kill(existingPid, 0); // check if process exists
      console.log(`⚠️  SparkUI is already running (PID ${existingPid}).`);
      console.log('   Run "sparkui stop" first, or delete .sparkui.pid if stale.');
      process.exit(1);
    } catch {
      // Process doesn't exist — stale PID file, clean it up
      fs.unlinkSync(pidFile);
    }
  }

  if (!config.envFile) {
    console.log('⚠️  No .env file found. Run "sparkui init" first, or create a .env file.');
    console.log('   Starting with defaults...');
  }

  // Build env for the child process
  const childEnv = { ...process.env };
  if (config.envFile) {
    const envVars = loadEnvFile(path.dirname(config.envFile));
    Object.assign(childEnv, envVars);
  }
  // CLI overrides
  if (getArg('--port')) childEnv.SPARKUI_PORT = getArg('--port');

  const serverScript = path.join(PKG_ROOT, 'server.js');
  const child = spawn(process.execPath, [serverScript], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  // Write PID file
  fs.writeFileSync(pidFile, String(child.pid));

  // Capture initial output briefly to confirm startup
  let started = false;
  const timeout = setTimeout(() => {
    if (!started) {
      console.log(`⚡ SparkUI server starting (PID ${child.pid})...`);
      console.log(`   Port: ${config.port}`);
      console.log(`   PID file: ${pidFile}`);
      console.log(`   Stop with: sparkui stop`);
      child.unref();
      process.exit(0);
    }
  }, 3000);

  child.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('SparkUI server running')) {
      started = true;
      clearTimeout(timeout);
      console.log(`⚡ SparkUI server started (PID ${child.pid})`);
      console.log(`   🌐 http://localhost:${config.port}/`);
      if (config.pushToken) {
        console.log(`   🔑 Token: ${config.pushToken.slice(0, 12)}...${config.pushToken.slice(-4)}`);
      }
      console.log(`   📄 PID file: ${pidFile}`);
      console.log(`   Stop with: sparkui stop`);
      child.unref();
      process.exit(0);
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`[server] ${output}`);
    }
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    console.error(`Error starting server: ${err.message}`);
    try { fs.unlinkSync(pidFile); } catch {}
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (!started) {
      clearTimeout(timeout);
      console.error(`Server exited with code ${code} before starting.`);
      try { fs.unlinkSync(pidFile); } catch {}
      process.exit(1);
    }
  });
}

// ── Stop Command ─────────────────────────────────────────────────────────────

function cmdStop() {
  const pidFile = path.join(process.cwd(), '.sparkui.pid');

  if (!fs.existsSync(pidFile)) {
    console.log('⚠️  No .sparkui.pid file found. Is SparkUI running from this directory?');
    process.exit(1);
  }

  const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`⚡ SparkUI server stopped (PID ${pid}).`);
  } catch (err) {
    if (err.code === 'ESRCH') {
      console.log(`⚠️  Process ${pid} not found. Cleaning up stale PID file.`);
    } else {
      console.error(`Error stopping server: ${err.message}`);
    }
  }

  try { fs.unlinkSync(pidFile); } catch {}
}

// ── Client Commands (push/update/delete/status) ─────────────────────────────

const BASE_URL = process.env.SPARKUI_URL || 'http://localhost:3457';
const TOKEN = process.env.PUSH_TOKEN || getArg('--token') || '';

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function cmdStatus() {
  const res = await request('GET', '/');
  console.log(JSON.stringify(res.body, null, 2));
}

async function cmdPush() {
  const htmlFile = getArg('--html');
  const template = getArg('--template');
  const dataStr = getArg('--data');
  const ttl = parseInt(getArg('--ttl') || '3600', 10);

  const body = { ttl };
  if (htmlFile) {
    body.html = fs.readFileSync(path.resolve(htmlFile), 'utf-8');
  } else if (template) {
    body.template = template;
    body.data = dataStr ? JSON.parse(dataStr) : {};
  } else {
    console.error('Error: provide --html <file> or --template <name>');
    process.exit(1);
  }

  const res = await request('POST', '/api/push', body);
  console.log(JSON.stringify(res.body, null, 2));
}

async function cmdUpdate() {
  const id = args[1];
  if (!id) { console.error('Error: provide page ID'); process.exit(1); }
  const htmlFile = getArg('--html');
  const template = getArg('--template');
  const dataStr = getArg('--data');
  const body = {};
  if (htmlFile) body.html = fs.readFileSync(path.resolve(htmlFile), 'utf-8');
  if (template) { body.template = template; body.data = dataStr ? JSON.parse(dataStr) : {}; }
  const ttl = getArg('--ttl');
  if (ttl) body.ttl = parseInt(ttl, 10);

  const res = await request('PATCH', `/api/pages/${id}`, body);
  console.log(JSON.stringify(res.body, null, 2));
}

async function cmdDelete() {
  const id = args[1];
  if (!id) { console.error('Error: provide page ID'); process.exit(1); }
  const res = await request('DELETE', `/api/pages/${id}`);
  console.log(JSON.stringify(res.body, null, 2));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(0);
  }

  switch (command) {
    case 'init':
      cmdInit();
      break;
    case 'start':
      cmdStart();
      break;
    case 'stop':
      cmdStop();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'push':
      await cmdPush();
      break;
    case 'update':
      await cmdUpdate();
      break;
    case 'delete':
      await cmdDelete();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
