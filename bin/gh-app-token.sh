#!/bin/bash
# Generate a short-lived GitHub App installation access token
# and write it to GH_TOKEN_FILE inside the per-run workspace.
#
# Required env:
#   GH_APP_ID              - GitHub App ID (numeric)
#   GH_APP_INSTALLATION_ID - GitHub App Installation ID (numeric)
#   GH_APP_KEY_FILE        - path to the GitHub App private key PEM file
#   GH_TOKEN_FILE          - output path (relative to workspace or absolute)
#
# The hostScript runs with cwd = workspacePath, so GH_TOKEN_FILE
# is typically a relative filename (e.g., ".gh-token") written
# into the per-run workspace. The workspace is later mounted
# as /workspace in the Docker container, where setupScript
# reads the same file.
set -euo pipefail

: "${GH_APP_ID:?required}"
: "${GH_APP_INSTALLATION_ID:?required}"
: "${GH_APP_KEY_FILE:?required}"
GH_TOKEN_FILE="${GH_TOKEN_FILE:-.gh-token}"

# ---------------------------------------------------------------------------
# No diagnostic output: avoid leaking credentials into logs
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Step 1: build a JSON Web Token (JWT) signed with the App private key
# ---------------------------------------------------------------------------
NOW=$(date +%s)
IAT=$((NOW - 60))  # 60s in the past to protect against clock drift
EXP=$((IAT + 540)) # 9 min after iat (max JWT lifetime is 10 min)

b64url() {
  openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$IAT" "$EXP" "$GH_APP_ID" | b64url)
SIGNATURE=$(printf '%s.%s' "$HEADER" "$PAYLOAD" | openssl dgst -sha256 -sign "$GH_APP_KEY_FILE" -binary | b64url)

JWT="$HEADER.$PAYLOAD.$SIGNATURE"

# ---------------------------------------------------------------------------
# Step 2: exchange JWT for an installation access token
# ---------------------------------------------------------------------------
if ! RESPONSE=$(curl -sS --connect-timeout 10 --max-time 30 -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/$GH_APP_INSTALLATION_ID/access_tokens" 2>&1); then
  echo "ERROR: curl failed" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

TOKEN=$(echo "$RESPONSE" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "ERROR: gh-app-token.sh: failed to obtain installation access token" >&2
  echo "GitHub API response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 3: write token to the per-run workspace file
# ---------------------------------------------------------------------------
mkdir -p "$(dirname "$GH_TOKEN_FILE")"
echo -n "$TOKEN" > "$GH_TOKEN_FILE"
chmod 600 "$GH_TOKEN_FILE"

ABS_PATH=$(cd "$(dirname "$GH_TOKEN_FILE")" && pwd)/$(basename "$GH_TOKEN_FILE")
echo "$ABS_PATH" >&2
