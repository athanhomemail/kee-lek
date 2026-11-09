#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot keeled' < schemas/04-auto-draws.sql
printf '%s\n' 'Automatic draw schedule table is ready. Existing data was preserved.'
