# SSH and Server Stability Fix Summary - Feb 25, 2026

## Issues Identified
1. **SSH Brute-Force Attack:** Massive influx of bot login attempts causing SSH `MaxStartups` limits to be reached, dropping legitimate connections.
2. **ERP Backend Crash Loop:** `tsfsystem.service` failing to start due to "Address already in use" (port 8000 blocked by zombie processes).

## Fixes Implemented
1. **Security Layer:** Installed and enabled `fail2ban`. It now automatically blocks IPs after failed login attempts.
2. **SSH Tuning:** Modified `/etc/ssh/sshd_config` to increase `MaxStartups` to `20:30:100`.
3. **Service Restore:** Force-killed processes on port 8000 and restarted `tsfsystem.service`.

## How to Resume Discussion if SSH Drops
1. **Reconnect to Terminal:** Use `ssh` to log back in.
2. **Attach to Tmux:** Run `tmux attach` to return to your active terminal session. Your command history and current state are preserved there.
3. **AI Persistence:** I (Antigravity) have access to "Persistent Context". If you start a new chat, just tell me you want to resume from the previous session, and I will be able to retrieve our history.
