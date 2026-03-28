# SparkUI Production Infrastructure Spec

**LaunchPad Task:** #231  
**Date:** 2026-03-27  
**Status:** Spec complete — partially already implemented

---

## 1. Current State Audit

### 1.1 Process Management

**Good news: SparkUI already has a systemd service.**

The task description mentioned `nohup node server.js` as the current state, but at some point a proper systemd unit was created and is active:

```ini
# /etc/systemd/system/sparkui.service
[Unit]
Description=SparkUI Server
After=network.target

[Service]
Type=simple
User=clawd
WorkingDirectory=/home/clawd/projects/sparkui
EnvironmentFile=/home/clawd/projects/sparkui/.env
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

- **Service enabled:** ✅ (starts on boot)
- **Currently running:** ✅ (PID 3962717)
- **Auto-restart:** ✅ (`Restart=always`, `RestartSec=3`)
- **Restart count:** 83,427 (high — see § 2.2 for concerns)
- **Last started:** 2026-03-27 22:21:59 EDT

### 1.2 Port & Networking

- **Port:** 3457 (configured via `SPARKUI_PORT=3457` in `.env`)
- **Binds to:** localhost (accessed via reverse proxy)
- **WebSocket:** `ws://localhost:3457/ws`

### 1.3 Caddy Reverse Proxy

Caddy is running as a systemd service (`enabled`, `active`) and reverse proxies to SparkUI:

```
sparkui.dev {
    reverse_proxy 127.0.0.1:3457
}
```

**Note:** Only `sparkui.dev` is configured. The `sparkui.limeadelabs.dev` alias mentioned in TOOLS.md is **not** in the Caddyfile — it may be handled elsewhere or needs adding.

Other services on the same Caddy instance:
- `launchpad.limeadelabs.dev` → :3001
- `brightblaze.limeadelabs.dev` → :3002
- `refibuy.limeadelabs.dev` → :3458
- Several static sites (aco-fantasy, limeadelabs.co, cad-game)

### 1.4 Redis

- **Running:** ✅ (systemd-managed, `enabled`)
- **Version:** 7.0.15
- **Port:** 6379 (default)
- **Uptime:** ~2.6 days at time of audit
- **SparkUI keys:** `sparkui:delivery`, `sparkui:pages` (+ 7 other keys in DB)
- **Usage:** Page storage and delivery worker queue (pub/sub or list-based)

### 1.5 Environment Variables

File: `/home/clawd/projects/sparkui/.env`

```
PUSH_TOKEN=spk_475a...cbef
SPARKUI_PORT=3457
OPENCLAW_HOOKS_URL=http://127.0.0.1:18789/hooks/agent
OPENCLAW_HOOKS_TOKEN=spk_hook_7bdbe...
SPARKUI_BASE_URL=https://sparkui.dev
```

Loaded by systemd via `EnvironmentFile` AND by the app's own `.env` parser in `server.js`.

### 1.6 VM Resources

| Resource | Value |
|----------|-------|
| CPU | 2 vCPUs |
| RAM | 7.8 GB (2.1 GB used, 5.7 GB available) |
| Disk | 77 GB (35 GB used, 42 GB free) |
| Swap | 2 GB (181 MB used) |
| OS | Ubuntu, kernel 6.8.0-106-generic |

### 1.7 Health Check

`GET /api/status` returns:
```json
{
  "status": "ok",
  "service": "sparkui",
  "version": "1.1.0",
  "pages": 4,
  "wsClients": 0,
  "templates": ["macro-tracker", "ws-test", ...],
  "uptime": 1253,
  "redis": "connected"
}
```

---

## 2. Issues & Improvements Needed

### 2.1 What's Already Good

- ✅ systemd service with auto-restart
- ✅ Environment variables in `.env` + `EnvironmentFile`
- ✅ Caddy TLS termination + reverse proxy
- ✅ Redis running as a managed service
- ✅ Health check endpoint exists

### 2.2 Concerns

**High restart count (83,427):** This suggests the process has been crashing and restarting frequently — possibly expected during active development (code changes trigger restarts) or an actual stability issue. Worth investigating with `journalctl -u sparkui --since "1 week ago" | grep -i error`.

**No resource limits:** The systemd unit has no memory/CPU limits. A runaway process could affect OpenClaw and other services on the same VM.

**No log rotation policy:** journald handles logs, but no explicit size limit is configured for SparkUI output.

**No dependency on Redis:** The unit file has `After=network.target` but no `After=redis-server.service`. If Redis isn't up when SparkUI starts, it may crash and loop until Redis is ready (which the `Restart=always` handles, but wastefully).

**Missing `sparkui.limeadelabs.dev`:** The Caddyfile only has `sparkui.dev`, not the `limeadelabs.dev` alias.

**Runs as `clawd` user:** Same user that runs OpenClaw. No process isolation.

### 2.3 Stripe Keys in Code?

The sandbox Stripe keys are documented in TOOLS.md. Verify they're in `.env` (or should be) rather than hardcoded in templates/server code. Production Stripe keys should **never** be in source files.

---

## 3. Recommended Production Setup

### 3.1 Improved systemd Service File

```ini
# /etc/systemd/system/sparkui.service
[Unit]
Description=SparkUI Server
Documentation=https://sparkui.dev
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=clawd
Group=clawd
WorkingDirectory=/home/clawd/projects/sparkui
EnvironmentFile=/home/clawd/projects/sparkui/.env
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=10

# Resource limits
MemoryMax=512M
MemoryHigh=384M
CPUQuota=80%

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/clawd/projects/sparkui
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkui

[Install]
WantedBy=multi-user.target
```

**Key improvements:**
- Redis dependency ordering (`After=redis-server.service`)
- Rate-limited restarts (`StartLimitBurst=10` in 5 minutes — prevents infinite crash loops)
- Memory cap at 512MB
- `NODE_ENV=production` for Express optimizations
- Security hardening (read-only filesystem except working dir)
- Explicit `SyslogIdentifier` for log filtering

### 3.2 Log Management

journald already handles log rotation globally. For SparkUI-specific filtering:

```bash
# View SparkUI logs
journalctl -u sparkui -f

# Last 100 lines
journalctl -u sparkui -n 100

# Errors only
journalctl -u sparkui -p err

# Since last boot
journalctl -u sparkui -b
```

Optionally add to `/etc/systemd/journald.conf`:
```ini
SystemMaxUse=1G
MaxFileSec=1week
```

### 3.3 Health Check Monitoring

Add a simple watchdog using a systemd timer or cron:

```bash
# /home/clawd/projects/sparkui/scripts/healthcheck.sh
#!/bin/bash
STATUS=$(curl -sf -m 5 http://localhost:3457/api/status | jq -r '.status' 2>/dev/null)
if [ "$STATUS" != "ok" ]; then
    echo "SparkUI health check failed, restarting..."
    systemctl restart sparkui
    # Optional: notify via OpenClaw
    openclaw system event --text "⚠️ SparkUI health check failed — auto-restarted" --mode now
fi
```

---

## 4. Separation Options

### Option A: Keep on Same VM, Properly Isolated ⭐ RECOMMENDED

**What:** Improve the existing systemd unit with resource limits and security hardening (§ 3.1).

**Pros:**
- Simplest path — 90% already done
- No additional infrastructure cost
- VM has plenty of headroom (5.7 GB RAM free, 42 GB disk)
- Caddy already configured
- Redis already shared and working

**Cons:**
- Shared VM means a catastrophic failure (disk full, OOM) affects everything
- Same `clawd` user (mitigated by systemd sandboxing)

**Effort:** ~30 minutes to update the service file and test.

### Option B: Separate VM/Container

**What:** Dedicated DO droplet or managed container.

**Pros:** Full isolation, independent scaling.

**Cons:** Extra $6-12/mo, need to set up Redis (or use managed), duplicate Caddy/TLS config, more operational overhead for a service that handles single-digit RPS.

**Verdict:** Overkill for current scale.

### Option C: Docker Compose on Same VM

**What:** Containerize SparkUI + Redis in Docker Compose.

**Pros:** Clean isolation, reproducible, easy to move later.

**Cons:** Adds Docker overhead to a 2-vCPU VM, another layer of complexity, need to wire Caddy to Docker network, and OpenClaw isn't containerized so it's inconsistent.

**Verdict:** Good for future but unnecessary complexity now.

### Recommendation

**Go with Option A.** The core problem (no process manager, no isolation, restarts kill it) is already 80% solved by the existing systemd service. The remaining 20% is:

1. Add resource limits and security hardening to the unit file
2. Add Redis dependency ordering
3. Add crash rate limiting
4. Set `NODE_ENV=production`
5. Add `sparkui.limeadelabs.dev` to Caddyfile
6. Investigate the high restart count

This is a 30-minute task, not an infrastructure project.

---

## 5. Migration Checklist

Since a systemd service already exists, this is an **in-place upgrade**, not a migration.

### Pre-flight

- [ ] Check current SparkUI status: `systemctl status sparkui`
- [ ] Review recent logs for errors: `journalctl -u sparkui --since "1 week ago" -p err`
- [ ] Verify health check: `curl http://localhost:3457/api/status`
- [ ] Back up current service file: `sudo cp /etc/systemd/system/sparkui.service /etc/systemd/system/sparkui.service.bak`

### Step-by-step

1. **Update the service file:**
   ```bash
   sudo nano /etc/systemd/system/sparkui.service
   # Apply changes from § 3.1
   ```

2. **Reload systemd:**
   ```bash
   sudo systemctl daemon-reload
   ```

3. **Add `sparkui.limeadelabs.dev` to Caddy:**
   ```bash
   sudo nano /etc/caddy/Caddyfile
   # Change:
   #   sparkui.dev {
   # To:
   #   sparkui.dev, sparkui.limeadelabs.dev {
   ```

4. **Reload Caddy (zero-downtime):**
   ```bash
   sudo systemctl reload caddy
   ```

5. **Restart SparkUI with new config:**
   ```bash
   sudo systemctl restart sparkui
   ```

6. **Verify:**
   ```bash
   systemctl status sparkui
   curl -s http://localhost:3457/api/status | jq .
   curl -s https://sparkui.dev/api/status | jq .
   curl -s https://sparkui.limeadelabs.dev/api/status | jq .
   ```

7. **Add health check script (optional):**
   ```bash
   chmod +x /home/clawd/projects/sparkui/scripts/healthcheck.sh
   # Add to crontab: */5 * * * * /home/clawd/projects/sparkui/scripts/healthcheck.sh
   ```

### Rollback

```bash
# Restore original service file
sudo cp /etc/systemd/system/sparkui.service.bak /etc/systemd/system/sparkui.service
sudo systemctl daemon-reload
sudo systemctl restart sparkui
```

### Zero-Downtime Notes

- `systemctl reload caddy` is zero-downtime (graceful reload)
- `systemctl restart sparkui` has a brief ~1-2s gap. For a service with single-digit RPS in dev/staging, this is negligible
- If true zero-downtime is needed later, consider Node.js cluster mode or a blue-green deploy with two ports

---

## 6. Summary

| Aspect | Current State | After Upgrade |
|--------|--------------|---------------|
| Process manager | systemd ✅ | systemd (hardened) ✅ |
| Auto-restart | Yes | Yes + rate-limited |
| Boot start | Yes (enabled) | Yes |
| Resource limits | None | 512MB RAM, 80% CPU |
| Security | Runs as clawd | + NoNewPrivileges, ProtectSystem |
| Redis dependency | Not declared | Explicit After/Wants |
| NODE_ENV | Not set | production |
| Logging | journald | journald (same, it works) |
| Health monitoring | Manual | Scripted + alerts |
| Caddy domains | sparkui.dev only | + sparkui.limeadelabs.dev |

**Bottom line:** The situation is better than described in the task. The nohup era is already over — SparkUI runs under systemd with auto-restart. What's needed is a ~30-minute hardening pass, not a major infrastructure change.
