# GitHub Flows Application Runtime Setup

- Path: `docs/setup/ubuntu/app.md`
- Template Version: `20260508`

## Purpose

This document describes how to deploy and configure `github-flows-app` under a dedicated Ubuntu runtime user referenced as `user`.

The document covers application directory creation, repository cloning, `.env` configuration, production dependency installation, `systemd` service registration, application logging, and log rotation.

This document assumes that the operating system runtime user, Docker access, `nvm`, and Node.js are already configured.

## Runtime Assumptions

The runtime user is referenced as `user`.

The application is deployed into:

```text
/home/user/app/github-flows/
```

The application listens on localhost:

```text
127.0.0.1:5020
```

The runtime workspace is located under the application directory:

```text
/home/user/app/github-flows/var/work/
```

The deployment-specific service name is referenced as `flows-user`.

## Create the Application Directory

Switch to the runtime user:

```bash
sudo -iu user
```

Create the application base directory:

```bash
mkdir -p ~/app
cd ~/app
```

## Clone the Application Repository

Clone `github-flows-app` into `~/app/github-flows`:

```bash
git clone https://github.com/flancer32/github-flows-app.git github-flows
cd ~/app/github-flows
```

The resulting application directory is:

```text
/home/user/app/github-flows/
```

## Create the `.env` Configuration

The application is configured through a local `.env` file.

Create it from the example:

```bash
cp .env.example .env
nano .env
```

Set the runtime values:

```env
HOST=127.0.0.1
PORT=5020
WORKSPACE_ROOT=./var/work
WEBHOOK_SECRET=replace-with-shared-secret
```

Restrict access to the configuration file:

```bash
chmod 600 .env
```

## Create Runtime Directories

Create the runtime workspace directories:

```bash
cd /home/user/app/github-flows

mkdir -p ./var/work
mkdir -p ./var/work/tmp
mkdir -p ./var/work/log
mkdir -p ./var/work/cfg
```

Create the application log file under the runtime user:

```bash
touch ./var/work/app.log
chmod 640 ./var/work/app.log
```

`./var/work/tmp` is reserved for short-lived execution artifacts when a runtime
profile uses host-side pre-launch preparation. Do not treat it as a long-lived
secret store.

## Create Runtime Links

The public `web/` directory may contain symbolic links to runtime log and configuration directories.

Create or update the links manually:

```bash
cd /home/user/app/github-flows

ln -sfn ../var/work/log ./web/log
ln -sfn ../var/work/cfg ./web/cfg
```

Check the links:

```bash
readlink -f ./web/log
readlink -f ./web/cfg
```

Expected targets:

```text
/home/user/app/github-flows/var/work/log
/home/user/app/github-flows/var/work/cfg
```

## Install Production Dependencies

The repository contains `package-lock.json`, and no build step is required.

Install only production dependencies:

```bash
cd /home/user/app/github-flows
npm ci --omit=dev
```

Show available npm scripts:

```bash
npm run
```

Test the application manually:

```bash
npm run start
```

Check local HTTP access:

```bash
curl -I http://127.0.0.1:5020/
```

Stop the manual process before registering the application as a service.

## Register the systemd Service

Create the service file:

```bash
sudo nano /etc/systemd/system/flows-user.service
```

Use this configuration:

```ini
[Unit]
Description=GitHub Flows App
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=user
Group=user
WorkingDirectory=/home/user/app/github-flows

ExecStart=/bin/bash -lc 'source /home/user/.nvm/nvm.sh && exec npm run start >> /home/user/app/github-flows/var/work/app.log 2>&1'

Restart=always
RestartSec=5

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

The service does not use `EnvironmentFile`. Runtime configuration is loaded by
the application from its local `.env` file.

The service is responsible only for keeping the host application running.
Per-execution launch behavior such as `hostScript`, container mounts, generated
token files, and `setupScript` stays in runtime profile configuration under
`WORKSPACE_ROOT/cfg/`.

The log redirection is placed inside `ExecStart` so that the log file is opened by the process running under `user`. This avoids creating the log file as `root`, which can happen when `StandardOutput=append:` is used by `systemd`.

## Enable and Start the Service

Reload `systemd`:

```bash
sudo systemctl daemon-reload
```

Enable the service:

```bash
sudo systemctl enable flows-user
```

Start the service:

```bash
sudo systemctl start flows-user
```

Check the service status:

```bash
systemctl status flows-user
```

Check the application log:

```bash
tail -f /home/user/app/github-flows/var/work/app.log
```

Check that the application listens on the configured local port:

```bash
ss -ltnp | grep 5020
```

Check HTTP access through the local application port:

```bash
curl -I http://127.0.0.1:5020/
```

## Configure Log Rotation

The application log is written to:

```text
/home/user/app/github-flows/var/work/app.log
```

Create the `logrotate` configuration:

```bash
sudo nano /etc/logrotate.d/flows-user
```

Use this configuration:

```conf
/home/user/app/github-flows/var/work/app.log {
    daily
    rotate 14

    missingok
    notifempty

    compress
    delaycompress

    copytruncate

    create 0640 user user

    su user user
}
```

Check the configuration:

```bash
sudo logrotate -d /etc/logrotate.d/flows-user
```

Force a test rotation if needed:

```bash
sudo logrotate -f /etc/logrotate.d/flows-user
```

After forced rotation, check the log files:

```bash
ls -lh /home/user/app/github-flows/var/work/app.log*
```

The active log file must remain writable by `user`.

## Verification Checklist

After the setup:

- the application repository is cloned to `/home/user/app/github-flows/`;
- the `.env` file is created from `.env.example`;
- the `.env` file is readable only by the runtime user;
- runtime directories exist under `/home/user/app/github-flows/var/work/`;
- `web/log` points to `/home/user/app/github-flows/var/work/log`;
- `web/cfg` points to `/home/user/app/github-flows/var/work/cfg`;
- `app.log` exists and is owned by `user`;
- production npm dependencies are installed;
- the application starts manually with `npm run start`;
- the `flows-user` systemd service is enabled;
- the service runs under the `user` account;
- the service starts the application through `nvm` and `npm run start`;
- the service restarts automatically on failure;
- stdout and stderr are written to `/home/user/app/github-flows/var/work/app.log`;
- log rotation is configured through `/etc/logrotate.d/flows-user`;
- the application is available locally at `http://127.0.0.1:5020/`.
