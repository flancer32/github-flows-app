# github-flows-app

Host application for running `@teqfw/github-flows` as an event-driven agent runtime.

## Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/flancer32/github-flows-app.git .
```

Create a `.env` file with the application settings:

```env
HOST=127.0.0.1
PORT=5020
WORKSPACE_ROOT=./var/work
RUNTIME_IMAGE=codex-agent
WEBHOOK_SECRET=replace-with-shared-secret
```

Install dependencies and start the application:

```bash
npm i
npm start
```

## Web Server

Run the application behind a web server and proxy only the GitHub webhook endpoint to the local service. Serve static files from the `web/` directory.

```apache
<VirtualHost *:80>
    ServerName example.com
    RewriteEngine On
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName example.com
    ErrorLog ${APACHE_LOG_DIR}/example.com.error.log
    CustomLog ${APACHE_LOG_DIR}/example.com.access.log combined

    DocumentRoot /path/to/github-flows-app/web

    <Directory /path/to/github-flows-app/web>
        Options FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ProxyPreserveHost On
    ProxyPass        /webhooks/github http://127.0.0.1:5020/webhooks/github
    ProxyPassReverse /webhooks/github http://127.0.0.1:5020/webhooks/github

    SSLCertificateFile /path/to/fullchain.pem
    SSLCertificateKeyFile /path/to/privkey.pem
    Include /path/to/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```

## System Service

Create a `systemd` unit for the application:

```ini
[Unit]
Description=GitHub Flows App
After=network.target

[Service]
Type=simple
User=appuser
Group=appuser
WorkingDirectory=/path/to/github-flows-app
ExecStart=/bin/bash -c 'source /path/to/nvm.sh && npm run start'
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=append:/path/to/github-flows-app/var/work/app.log
StandardError=append:/path/to/github-flows-app/var/work/app.log

[Install]
WantedBy=multi-user.target
```

Reload `systemd`, then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable github-flows-app
sudo systemctl start github-flows-app
```

## Log Rotation

Create a `logrotate` rule for the application log:

```conf
/path/to/github-flows-app/var/work/app.log {
    daily
    rotate 14

    missingok
    notifempty

    compress
    delaycompress

    copytruncate

    create 0640 appuser appuser

    su appuser appuser
}
```

Test the configuration and force a rotation if needed:

```bash
sudo logrotate -d /etc/logrotate.d/github-flows-app
sudo logrotate -f /etc/logrotate.d/github-flows-app
```

