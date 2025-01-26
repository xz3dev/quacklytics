QUERY2="
    delete from events;
    copy events from 'events.csv.gz';
"

duckdb ../../backend/_data/analytics_test.db "$QUERY2"

