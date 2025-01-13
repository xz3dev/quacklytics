#!/bin/bash

QUERY="
    select distinct on (id)
        uuid as id,
        timestamp,
        event as event_type,
        person_id as user_id,
        properties,
    from posthog.events
    into outfile '/events.csv.gz'
    TRUNCATE
    COMPRESSION 'gzip'
    format CSVWithNames;
"

ssh root@ph.fmennen.de "docker container exec posthog-clickhouse-1 clickhouse-client --query \"$QUERY\""
ssh root@ph.fmennen.de "docker container cp posthog-clickhouse-1:/events.csv.gz /events.csv.gz"

rm -f events.csv.gz

rsync --progress -e ssh root@ph.fmennen.de:/events.csv.gz .

echo "Download complete. Importing..."

QUERY2="
    delete from events;
    copy events from 'events.csv.gz';
"

duckdb ../../backend/_data/analytics_test.db "$QUERY2"

