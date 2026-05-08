# Apache Proxy and Protected Runtime Access Setup

- Path: `docs/setup/ubuntu/apache.md`
- Template Version: `20260508`

## Purpose

This document describes how to configure Apache2 for `github-flows-app`.

Apache2 is responsible for:

- serving public static files directly;
- redirecting HTTP requests to HTTPS;
- proxying webhook requests to the local Node.js application;
- exposing runtime logs and launch configuration files through symbolic links protected by HTTP Basic Authentication;
- writing dedicated Apache access and error logs.

This document assumes that the application is already deployed under a dedicated runtime user referenced as `user`.

## Runtime Assumptions

The application directory is:

```text
/home/user/app/github-flows/
```

The public web root is:

```text
/home/user/app/github-flows/web/
```

The runtime workspace is:

```text
/home/user/app/github-flows/var/work/
```

The protected runtime directories are:

```text
/home/user/app/github-flows/var/work/log/
/home/user/app/github-flows/var/work/cfg/
```

The Node.js application listens on localhost:

```text
127.0.0.1:5020
```

The deployment-specific Apache site name is referenced as `flows-user`.

The public host name is referenced as:

```text
flows.user.example.com
```

The Let's Encrypt certificate for `flows.user.example.com` must already exist.

## Runtime Model

```text
HTTPS request
  -> Apache2
  -> static files from /home/user/app/github-flows/web
  -> webhook proxy to http://127.0.0.1:5020
  -> protected log/cfg directories through Basic Auth
```

The Node.js application is not exposed directly to the public network. It listens only on `127.0.0.1`.

## Install Required Packages

Run as an administrator:

```bash
sudo apt update
sudo apt install -y apache2 apache2-utils
```

The packages provide:

```text
- apache2: web server runtime;
- apache2-utils: utility tools such as htpasswd.
```

Check Apache status:

```bash
sudo systemctl status apache2
```

## Enable Required Apache Modules

Run as an administrator:

```bash
sudo a2enmod ssl rewrite proxy proxy_http headers auth_basic
sudo systemctl reload apache2
```

## Create Basic Authentication User

Create or update the Apache password file and add the runtime access user:

```bash
sudo htpasswd /etc/apache2/htpasswd user
```

If the password file does not exist yet:

```bash
sudo htpasswd -c /etc/apache2/htpasswd user
```

Use `-c` only when creating a new file. It overwrites an existing password file.

Fix the file permissions after creating the user:

```bash
sudo chown root:www-data /etc/apache2/htpasswd
sudo chmod 640 /etc/apache2/htpasswd
```

Apache must be able to read the file, while write access remains restricted to root.

## Create Runtime Links

The protected runtime directories are exposed through symbolic links inside the public `web/` directory.

Run under the runtime user:

```bash
sudo -iu user

cd /home/user/app/github-flows

mkdir -p ./var/work/log
mkdir -p ./var/work/cfg

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

## Filesystem Access

Apache runs under the `www-data` user on Ubuntu.

The `www-data` user must be able to traverse the parent directories and read files from:

```text
/home/user/app/github-flows/web/
/home/user/app/github-flows/var/work/log/
/home/user/app/github-flows/var/work/cfg/
```

Write access should remain owned by the runtime user.

If Apache cannot read the files or traverse the path, check access with:

```bash
sudo -u www-data test -x /home/user && echo home-ok
sudo -u www-data test -x /home/user/app && echo app-ok
sudo -u www-data test -x /home/user/app/github-flows && echo repo-ok
sudo -u www-data test -r /home/user/app/github-flows/web/index.html && echo index-ok
sudo -u www-data test -x /home/user/app/github-flows/var/work/log && echo log-ok
sudo -u www-data test -x /home/user/app/github-flows/var/work/cfg && echo cfg-ok
```

If a check does not print the expected `*-ok` message, fix traversal or read permissions according to the local filesystem permission policy.

## Apache Site Configuration

Verify that the Let's Encrypt certificate files exist for the target host:

```bash
sudo ls -l /etc/letsencrypt/live/flows.user.example.com/fullchain.pem
sudo ls -l /etc/letsencrypt/live/flows.user.example.com/privkey.pem
```

Create the site configuration file:

```bash
sudo nano /etc/apache2/sites-available/flows-user.conf
```

Use this configuration:

```apache
<VirtualHost *:80>
    ServerName flows.user.example.com
    ServerAdmin admin@example.com

    RewriteEngine On
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName flows.user.example.com
    ServerAdmin admin@example.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/flows.user.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/flows.user.example.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    DocumentRoot /home/user/app/github-flows/web

    DirectoryIndex index.html
    ErrorDocument 404 /404.html

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    <Directory /home/user/app/github-flows/web>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        <FilesMatch "(^\.|\.env$|package(-lock)?\.json$|README\.md$)">
            Require all denied
        </FilesMatch>
    </Directory>

    # Protected runtime directories exposed through web/cfg and web/log symlinks.
    <DirectoryMatch "^/home/user/app/github-flows/(web/(cfg|log)|var/work/(cfg|log))(/.*)?$">
        Options +Indexes +FollowSymLinks
        AllowOverride None

        IndexOptions FancyIndexing HTMLTable NameWidth=*

        AuthType Basic
        AuthName "GitHub Flows Runtime"
        AuthUserFile /etc/apache2/htpasswd
        Require valid-user
    </DirectoryMatch>

    ProxyPass /webhooks/github http://127.0.0.1:5020/webhooks/github
    ProxyPassReverse /webhooks/github http://127.0.0.1:5020/webhooks/github

    ErrorLog ${APACHE_LOG_DIR}/github-flows-user-error.log
    CustomLog ${APACHE_LOG_DIR}/github-flows-user-access.log combined
</VirtualHost>
```

## Enable the Site

```bash
sudo a2ensite flows-user.conf
sudo apachectl configtest
sudo systemctl reload apache2
```

## Verification

Check HTTP-to-HTTPS redirect:

```bash
curl -I http://flows.user.example.com/
```

Expected result:

```text
HTTP/1.1 301 Moved Permanently
Location: https://flows.user.example.com/
```

Check HTTPS access:

```bash
curl -I https://flows.user.example.com/
```

Check the proxied webhook endpoint:

```bash
curl -I https://flows.user.example.com/webhooks/github
```

The request must reach the local Node.js application. The exact HTTP status code depends on application behavior.

Check protected runtime directories without credentials:

```bash
curl -I https://flows.user.example.com/log/
curl -I https://flows.user.example.com/cfg/
```

Expected result:

```text
HTTP/1.1 401 Unauthorized
```

Check protected runtime directories with credentials:

```bash
curl -u user:<password> https://flows.user.example.com/log/
curl -u user:<password> https://flows.user.example.com/cfg/
```

Check Apache logs:

```bash
sudo tail -f /var/log/apache2/github-flows-user-access.log
sudo tail -f /var/log/apache2/github-flows-user-error.log
```

## Troubleshooting

If `/log/` or `/cfg/` returns:

```text
AH01276: Cannot serve directory ... No matching DirectoryIndex found, and server-generated directory index forbidden by Options directive
```

then Apache did not apply `Options +Indexes` to the requested path.

Check that the `DirectoryMatch` pattern includes the optional trailing slash and nested paths:

```apache
<DirectoryMatch "^/home/user/app/github-flows/(web/(cfg|log)|var/work/(cfg|log))(/.*)?$">
```

The `(/.*)?$` part is required because Apache may resolve the requested path as:

```text
/home/user/app/github-flows/web/log/
/home/user/app/github-flows/web/cfg/
```

If access still fails, replace `DirectoryMatch` with explicit `<Directory>` blocks for both symlink paths and real filesystem paths.

## Result

After this setup:

- Apache2 and Apache utility tools are installed;
- required Apache modules are enabled;
- HTTP requests are redirected to HTTPS;
- HTTPS is served by Apache2 with the configured Let's Encrypt certificate;
- public static files are served directly from the application `web/` directory;
- `/log/` and `/cfg/` are exposed through symbolic links from the public `web/` directory;
- `/webhooks/github` requests are proxied to the local Node.js application;
- `/log/` is available through Basic Authentication;
- `/cfg/` is available through Basic Authentication;
- directory listing is enabled only for protected runtime directories;
- sensitive files under the public web root are denied;
- Apache request logs are written to dedicated access and error log files.
