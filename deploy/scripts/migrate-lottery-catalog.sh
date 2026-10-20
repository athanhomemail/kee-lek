#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot keeled' < schemas/03-lottery-catalog.sql
printf '%s\n' 'Lottery catalog migration is ready. Existing bills and draws were preserved.'
