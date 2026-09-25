//go:build ingestionpoc

package processor

import (
	"analytics/database/analyticsdb"
	"analytics/database/types"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/duckdb/duckdb-go/v2"
	"github.com/google/uuid"
	"github.com/mattn/go-sqlite3"
)

// A benchmark-only dialect adapter lets the actual Go processor run unchanged
// against SQLite. No identity or schema logic is reimplemented. List lookups
// become indexed IN-subqueries, and numbered DuckDB parameters become ?N.
// Prepared statements are cached per connection, as in the TS SQLite adapter.
type pocSQLiteDriver struct{}
type pocSQLiteConn struct {
	*sqlite3.SQLiteConn
	statements map[string]*sqlite3.SQLiteStmt
}

var pocParameter = regexp.MustCompile(`\$(\d+)`)

func init() { sql.Register("ingestion-poc-sqlite", pocSQLiteDriver{}) }

func (pocSQLiteDriver) Open(name string) (driver.Conn, error) {
	conn, err := (&sqlite3.SQLiteDriver{}).Open(name)
	if err != nil {
		return nil, err
	}
	return &pocSQLiteConn{conn.(*sqlite3.SQLiteConn), make(map[string]*sqlite3.SQLiteStmt)}, nil
}

func (c *pocSQLiteConn) CheckNamedValue(value *driver.NamedValue) error {
	if ids, ok := value.Value.(types.StringList); ok {
		encoded, err := json.Marshal([]string(ids))
		if err != nil {
			return err
		}
		value.Value = string(encoded)
		return nil
	}
	return driver.ErrSkip
}

func (c *pocSQLiteConn) cached(ctx context.Context, query string) (*sqlite3.SQLiteStmt, error) {
	if stmt := c.statements[query]; stmt != nil {
		return stmt, nil
	}
	translated := strings.ReplaceAll(query, "list_contains($1::TEXT[], id)", "id IN (SELECT value FROM json_each($1))")
	translated = strings.ReplaceAll(translated, "list_contains($1::TEXT[], session_id)", "session_id IN (SELECT value FROM json_each($1))")
	translated = pocParameter.ReplaceAllString(translated, "?$1")
	stmt, err := c.SQLiteConn.PrepareContext(ctx, translated)
	if err != nil {
		return nil, err
	}
	c.statements[query] = stmt.(*sqlite3.SQLiteStmt)
	return c.statements[query], nil
}

func (c *pocSQLiteConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	// SQLite's connection Exec handles multiple statements during setup. All
	// production ingestion statements are single statements without semicolons.
	if strings.Contains(query, ";") {
		return c.SQLiteConn.ExecContext(ctx, query, args)
	}
	stmt, err := c.cached(ctx, query)
	if err != nil {
		return nil, err
	}
	return stmt.ExecContext(ctx, args)
}

func (c *pocSQLiteConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	stmt, err := c.cached(ctx, query)
	if err != nil {
		return nil, err
	}
	return stmt.QueryContext(ctx, args)
}

func (c *pocSQLiteConn) Close() error {
	for _, stmt := range c.statements {
		if err := stmt.Close(); err != nil {
			return err
		}
	}
	return c.SQLiteConn.Close()
}

const pocSQLiteDDL = `
CREATE TABLE events(id TEXT PRIMARY KEY, timestamp DATETIME NOT NULL, event_type TEXT NOT NULL,
  session_id TEXT, person_id TEXT, properties TEXT NOT NULL, person_properties TEXT NOT NULL);
CREATE INDEX events_timestamp ON events(timestamp);
CREATE INDEX events_session ON events(session_id);
CREATE TABLE persons(id TEXT PRIMARY KEY, first_seen DATETIME NOT NULL, properties TEXT NOT NULL, property_timestamps TEXT NOT NULL);
CREATE TABLE sessions(id TEXT PRIMARY KEY, person_id TEXT REFERENCES persons(id), first_seen DATETIME NOT NULL, last_seen DATETIME NOT NULL);
`

func pocSQLiteProfile() (string, string, string) {
	profile := os.Getenv("POC_SQLITE_PROFILE")
	if profile == "" {
		profile = "delete-full"
	}
	switch profile {
	case "delete-full", "wal-full", "wal-normal":
	default:
		panic("invalid SQLite profile")
	}
	parts := strings.Split(strings.ToUpper(profile), "-")
	return profile, parts[0], parts[1]
}
func pocSQLiteDSN(file string) string {
	_, journal, synchronous := pocSQLiteProfile()
	return file + "?_journal_mode=" + journal + "&_synchronous=" + synchronous + "&_foreign_keys=on&_loc=UTC"
}
func openPoCSQLite(file string) *pocDB {
	db, err := sql.Open("ingestion-poc-sqlite", pocSQLiteDSN(file))
	if err != nil {
		panic(err)
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		panic(err)
	}
	return &pocDB{db: db, sqlite: true}
}

type pocSQLiteAppender struct {
	tx  *sql.Tx
	err error
}

func (d *pocDB) sqliteAppender(table string) analyticsdb.DuckDBAppender {
	if table != "events" {
		panic("PoC appender only supports events")
	}
	tx, err := d.db.Begin()
	if err != nil {
		panic(err)
	}
	return &pocSQLiteAppender{tx: tx}
}

func (a *pocSQLiteAppender) AppendRow(values ...driver.Value) error {
	if a.err != nil {
		return a.err
	}
	if len(values) != 7 {
		a.err = fmt.Errorf("expected 7 event columns")
		return a.err
	}
	args := make([]any, len(values))
	for i, value := range values {
		args[i] = value
	}
	args[0] = uuid.UUID(values[0].(duckdb.UUID)).String()
	args[5] = string(values[5].(json.RawMessage))
	args[6] = string(values[6].(json.RawMessage))
	_, a.err = a.tx.Exec("INSERT INTO events VALUES (?,?,?,?,?,?,?)", args...)
	return a.err
}

func (a *pocSQLiteAppender) Flush() error { return a.err }
func (a *pocSQLiteAppender) Close() error {
	if a.err != nil {
		_ = a.tx.Rollback()
		return a.err
	}
	return a.tx.Commit()
}
