#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot keeled' < schemas/02-member-discounts.sql
printf '%s\n' 'Member discount tables are ready. Existing data was not changed.'
