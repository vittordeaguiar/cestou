#!/usr/bin/env bash
# Idempotent repository bootstrap for Cursor Cloud Agents.
# Runs once after the repository is checked out. Must terminate and must not
# start long-running daemons (that belongs in start.sh / terminals).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Docker (runtime for the local Supabase stack) ------------------------
# The Supabase CLI runs Postgres/Auth/Realtime/Storage/etc. as Docker
# containers, so a working Docker Engine must be available.
if ! command -v docker >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker.io fuse-overlayfs uidmap iptables
fi

# Cloud Agent VMs boot on an overlay root filesystem, so Docker cannot stack
# the default overlay2 driver on top of it (mounts fail with EINVAL).
# fuse-overlayfs is the storage driver that works in this nested setup.
sudo mkdir -p /etc/docker
if ! grep -qs 'fuse-overlayfs' /etc/docker/daemon.json 2>/dev/null; then
  echo '{ "storage-driver": "fuse-overlayfs" }' | sudo tee /etc/docker/daemon.json >/dev/null
fi
sudo usermod -aG docker "$(id -un)" 2>/dev/null || true

# --- Node dependencies ----------------------------------------------------
npm ci
