#!/usr/bin/env bash
# Per-boot reconciliation for Cursor Cloud Agents.
# Brings up the Docker daemon and the local Supabase stack, then returns so the
# long-running dev server can start as a terminal. Safe to run repeatedly.
set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Nested Docker networking fix -----------------------------------------
# In the Cloud Agent pod, bridged container frames traverse the iptables
# FORWARD chain (bridge-nf-call-iptables=1) and the legacy FORWARD policy is
# DROP, which silently blocks container-to-container traffic (Supabase services
# cannot reach Postgres). Make bridged frames bypass iptables entirely.
sudo modprobe br_netfilter 2>/dev/null || true
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 net.bridge.bridge-nf-call-ip6tables=0 2>/dev/null || true

# --- Docker daemon --------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  sudo rm -f /var/run/docker.pid 2>/dev/null || true
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi
# Allow the agent user to use the Docker socket without re-login.
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

# --- Local Supabase stack -------------------------------------------------
# Idempotent: a no-op when already running. First run pulls images and applies
# every migration in supabase/migrations.
node_modules/.bin/supabase start

# --- Local environment file -----------------------------------------------
# Derive values from the running stack. Only written when absent so custom
# values are never overwritten. These are well-known local demo keys.
if [ ! -f .env.local ]; then
  SB_API_URL=""; SB_ANON_KEY=""; SB_PUBLISHABLE_KEY=""; SB_SERVICE_ROLE_KEY=""
  while IFS= read -r line; do
    case "$line" in
      API_URL=*)          SB_API_URL="${line#API_URL=}" ;;
      ANON_KEY=*)         SB_ANON_KEY="${line#ANON_KEY=}" ;;
      PUBLISHABLE_KEY=*)  SB_PUBLISHABLE_KEY="${line#PUBLISHABLE_KEY=}" ;;
      SERVICE_ROLE_KEY=*) SB_SERVICE_ROLE_KEY="${line#SERVICE_ROLE_KEY=}" ;;
    esac
  done < <(node_modules/.bin/supabase status -o env 2>/dev/null | tr -d '"')

  cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${SB_API_URL:-http://127.0.0.1:54321}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SB_PUBLISHABLE_KEY:-$SB_ANON_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=${SB_SERVICE_ROLE_KEY}
DEEPSEEK_API_KEY=
FIRECRAWL_API_KEY=
EOF
fi
