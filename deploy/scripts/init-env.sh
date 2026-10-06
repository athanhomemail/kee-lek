#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
output="$root/deploy/.env"
if [ -e "$output" ]; then
  printf '%s\n' 'deploy/.env already exists; refusing to overwrite secrets.' >&2
  exit 1
fi
command -v openssl >/dev/null
umask 077
{
  printf 'WEB_PORT=8081\n'
  printf 'MYSQL_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'MYSQL_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 48)"
  printf 'ADMIN_INITIAL_PASSWORD=%s\n' "$(openssl rand -hex 16)"
} > "$output"
printf '%s\n' 'Created deploy/.env with fresh secrets (mode 600). View the initial Admin password locally on the VPS; do not share this file.'
