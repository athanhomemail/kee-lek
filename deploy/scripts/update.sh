#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Working tree has changes; review them before updating.' >&2
  exit 1
fi
sh deploy/scripts/backup.sh
git pull --ff-only origin main
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait
printf '%s\n' 'Updated. Check https://keelek.kuayrai.com and review service logs.'
