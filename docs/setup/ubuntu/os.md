# Ubuntu Runtime Environment Setup

- Path: `docs/setup/ubuntu/os.md`
- Template Version: `20260508`

## Purpose

This document describes the base Ubuntu operating system setup for a dedicated runtime user account referenced as `user`.

The account is intended to run application processes, use Docker, and maintain its own Node.js runtime through `nvm`.

This document does not describe application deployment, application configuration, Apache virtual hosts, reverse proxy rules, or service management.

## Prerequisites

Docker must be installed and running on the host.

Check Docker status:

```bash
sudo systemctl status docker
```

If Docker is not installed, install and enable it before configuring the runtime user.

## Install Required System Packages

Run as an administrator:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential
```

The packages provide:

```text
- git: repository access;
- curl: remote installation scripts and HTTP checks;
- ca-certificates: TLS certificate validation;
- build-essential: native dependency build tooling.
```

## Create the Runtime User

Create the dedicated user without password-based login:

```bash
sudo adduser --disabled-password --gecos "" user
sudo passwd -l user
```

The account is not intended for direct SSH password login.

Administrative access to the account is performed through `sudo` from an authorized administrator account:

```bash
sudo -iu user
```

## Allow Docker Usage

Add the runtime user to the `docker` group:

```bash
sudo usermod -aG docker user
```

The group membership becomes active after starting a new login session for the user.

Switch to the runtime user:

```bash
sudo -iu user
```

Check the current user and group membership:

```bash
whoami
groups
```

Expected user:

```text
user
```

The `docker` group should be present in the group list.

Check Docker access:

```bash
docker ps
```

## Install nvm and Node.js

Run the commands under the `user` account.

Install `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
```

The command uses the current upstream installer. Pin a specific `nvm` release if strict reproducibility is required.

Load `nvm` into the current shell session:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
```

Install the current LTS version of Node.js:

```bash
nvm install --lts
nvm alias default node
```

Check the installation:

```bash
node -v
npm -v
```

## Result

After this setup:

- the runtime user `user` exists;
- password-based login for `user` is disabled;
- administrative access is available through `sudo -iu user`;
- `user` can run Docker containers;
- required system packages are installed;
- `nvm` is installed under the `user` account;
- Node.js LTS is installed under the `user` account;
- npm is available under the `user` account.
