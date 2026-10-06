#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$root"
umask 077
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
output="backups/keeled-$stamp.sql"
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --no-tablespaces keeled' > "$output.tmp"
mv "$output.tmp" "$output"
gzip "$output"
printf 'Backup saved: %s.gz\n' "$output"
