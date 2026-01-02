# Deployment Guide

## Overview
Host two separate instances on subdomains using Caddy as reverse proxy.

## 1. DNS Setup
Add A records pointing to your VPS IP:
- `work-notes.sisinger.com` → VPS IP
- `braindump.sisinger.com` → VPS IP

## 2. Server Setup

Install dependencies:
```bash
curl -sSf https://sh.rustup.rs | sh  # for uv
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
pip install uv  # or install via system package manager
```

Install Caddy (auto-handles Let's Encrypt):
```bash
# Debian/Ubuntu
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy
```

## 3. App Setup

Create two instances:
```bash
# Work instance
/opt/braindump-work/
├── config.json  # port: 5001, data_dir: ./data
└── ...

# Personal instance
/opt/braindump-personal/
├── config.json  # port: 5002, data_dir: ./data
└── ...
```

Clone and setup each:
```bash
cd /opt/braindump-work
git clone <repo> .
uv sync
cp config.example.json config.json
# Edit config.json: set port to 5001
```

## 4. Systemd Services

Create `/etc/systemd/system/braindump-work.service`:
```ini
[Unit]
Description=Braindump Work Notes
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/braindump-work
ExecStart=/usr/local/bin/uv run braindump
Restart=always

[Install]
WantedBy=multi-user.target
```

Similar for `braindump-personal.service` (change paths/port).

Enable and start:
```bash
systemctl daemon-reload
systemctl enable --now braindump-work braindump-personal
```

## 5. Caddy Configuration

Edit `/etc/caddy/Caddyfile`:
```
work-notes.sisinger.com {
    reverse_proxy localhost:5001
}

braindump.sisinger.com {
    reverse_proxy localhost:5002
}
```

Restart Caddy:
```bash
systemctl restart caddy
```

Caddy automatically obtains and renews Let's Encrypt certificates.

## 6. Verify

- Check services: `systemctl status braindump-work braindump-personal`
- Check Caddy: `systemctl status caddy`
- Visit both subdomains to confirm HTTPS works

## Updates

```bash
cd /opt/braindump-work
git pull
uv sync
systemctl restart braindump-work
```
