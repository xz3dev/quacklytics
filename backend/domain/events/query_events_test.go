package events

import (
	"analytics/database/analyticsdb"
	"analytics/domain/queries"
	"database/sql"
	"testing"

	_ "github.com/duckdb/duckdb-go/v2"
	"github.com/zeebo/assert"
)

func TestQueryEventsParsesDuckDBJSONProperties(t *testing.T) {
	db, err := sql.Open("duckdb", "")
	assert.NoError(t, err)
	defer db.Close()

	_, err = db.Exec(`
create table events
(
    id                uuid primary key,
    timestamp         timestamp not null,
    event_type        text      not null,
    session_id        text,
    person_id         text,
    properties        json      not null,
    person_properties json      not null
);
create table sessions
(
    id         text primary key,
    person_id  text,
    first_seen timestamp not null,
    last_seen  timestamp not null
);
insert into sessions values ('session-1', 'person-1', now(), now());
insert into events values (uuid(), now(), 'click', 'session-1', null, '{"path":"/docs","count":2}', '{}');
`)
	assert.NoError(t, err)

	result, err := QueryEvents(&analyticsdb.DuckDBConnection{Db: db}, &queries.EmptyQueryParams)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(*result))
	assert.Equal(t, "click", (*result)[0].EventType)
	assert.Equal(t, "/docs", (*result)[0].Properties["path"])
	assert.Equal(t, float64(2), (*result)[0].Properties["count"])
	assert.Equal(t, "person-1", *(*result)[0].PersonId)
}
