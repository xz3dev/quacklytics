#!/bin/bash

QUERY="
    select distinct on (id)
        uuid as id,
        timestamp,
        event as event_type,
        distinct_id as distinct_id,
        properties,
    from posthog.events
    into outfile '/events.csv.gz'
    TRUNCATE
    COMPRESSION 'gzip'
    format CSVWithNames;
"
echo "Exporting from DB..."
ssh root@$POSTHOG_HOMESERVER "docker container exec posthog-clickhouse-1 clickhouse-client --query \"$QUERY\""
echo "Copy to server..."
ssh root@$POSTHOG_HOMESERVER "docker container cp posthog-clickhouse-1:/events.csv.gz /events.csv.gz"

echo "Downloading to client..."
rm -f events.csv.gz

rsync --progress -e ssh root@$POSTHOG_HOMESERVER:/events.csv.gz .

echo "Download complete. Importing..."

QUERY2="
    delete from events;
    copy events from 'events.csv.gz';
"

duckdb ../../backend/_data/analytics_default.db "$QUERY2"

