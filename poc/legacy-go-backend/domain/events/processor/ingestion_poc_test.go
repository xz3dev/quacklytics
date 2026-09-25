//go:build ingestionpoc

package processor

import (
	"analytics/database/analyticsdb"
	"analytics/domain/events"
	"analytics/domain/schema"
	"analytics/log"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/duckdb/duckdb-go/v2"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type pocDB struct {
	db     *sql.DB
	conn   driver.Conn
	sqlite bool
}

func (d *pocDB) Tx() (*sql.Tx, error) { return d.db.Begin() }
func (d *pocDB) Appender(table string) analyticsdb.DuckDBAppender {
	if d.sqlite {
		return d.sqliteAppender(table)
	}
	a, err := duckdb.NewAppenderFromConn(d.conn, "", table)
	if err != nil {
		panic(err)
	}
	return a
}
func (d *pocDB) close() {
	if d.conn != nil {
		if err := d.conn.Close(); err != nil {
			panic(err)
		}
	}
	if err := d.db.Close(); err != nil {
		panic(err)
	}
}
func openPoCDB(file string) *pocDB {
	c, err := duckdb.NewConnector(file, nil)
	if err != nil {
		panic(err)
	}
	conn, err := c.Connect(context.Background())
	if err != nil {
		panic(err)
	}
	var connector driver.Connector = c
	if pocDuckCacheEnabled() {
		connector = pocDuckConnector{c}
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(1)
	return &pocDB{db: db, conn: conn}
}

// TestIngestionPoC calls the actual production processor. It is deliberately
// opt-in and never opens application databases. The runner supplies a temp dir.
func TestIngestionPoC(t *testing.T) {
	fixturePath, dir := os.Getenv("POC_FIXTURE"), os.Getenv("POC_DIR")
	if fixturePath == "" || dir == "" {
		t.Skip("run via poc/ingestion")
	}
	log.SilenceIngestionPoC()
	check := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	var fixture struct {
		Warmup  []string `json:"warmup"`
		Batches []string `json:"batches"`
	}
	data, err := os.ReadFile(fixturePath)
	check(err)
	check(json.Unmarshal(data, &fixture))
	check(os.MkdirAll(dir, 0700))
	dataPath, appPath := filepath.Join(dir, "events.db"), filepath.Join(dir, "app.sqlite")
	openDB := openPoCDB
	if os.Getenv("POC_BACKEND") == "sqlite" {
		openDB = openPoCSQLite
	}
	db := openDB(dataPath)
	ddl, err := os.ReadFile(os.Getenv("POC_SCHEMA"))
	check(err)
	if db.sqlite {
		ddl = []byte(pocSQLiteDDL)
	}
	_, err = db.db.Exec(string(ddl))
	check(err)
	if !db.sqlite {
		_, err = db.db.Exec("CREATE INDEX events_timestamp ON events(timestamp); CREATE INDEX events_session ON events(session_id)")
		check(err)
	}
	app, err := gorm.Open(sqlite.Open(pocSQLiteDSN(appPath)), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	check(err)
	adb, err := app.DB()
	check(err)
	adb.SetMaxOpenConns(1)
	settings := map[string]map[string]any{}
	sqliteDBs := map[string]*sql.DB{"schemas": adb}
	if db.sqlite {
		sqliteDBs["events"] = db.db
	}
	profile, journal, synchronous := pocSQLiteProfile()
	for name, connection := range sqliteDBs {
		_, err := connection.Exec("PRAGMA wal_autocheckpoint=1000; PRAGMA fullfsync=OFF; PRAGMA checkpoint_fullfsync=ON; PRAGMA cache_size=-16000; PRAGMA mmap_size=0; PRAGMA temp_store=FILE; PRAGMA secure_delete=OFF; PRAGMA locking_mode=NORMAL; PRAGMA automatic_index=ON")
		check(err)
		settings[name] = map[string]any{}
		for _, pragma := range []string{"journal_mode", "synchronous", "wal_autocheckpoint", "page_size", "fullfsync", "checkpoint_fullfsync", "foreign_keys", "cache_size", "mmap_size", "temp_store", "secure_delete", "locking_mode", "automatic_index"} {
			var value any
			check(connection.QueryRow("PRAGMA " + pragma).Scan(&value))
			settings[name][pragma] = value
		}
		expectedSync := int64(2)
		if synchronous == "NORMAL" {
			expectedSync = 1
		}
		if settings[name]["journal_mode"] != strings.ToLower(journal) || settings[name]["synchronous"] != expectedSync || settings[name]["wal_autocheckpoint"] != int64(1000) {
			t.Fatalf("Unexpected SQLite settings: %v", settings[name])
		}
	}
	check(app.AutoMigrate(&schema.EventSchema{}, &schema.EventSchemaProperty{}, &schema.EventSchemaPropertyValue{}))
	proc := NewProjectProcessor("poc", app, db)
	mode := os.Getenv("POC_MODE")
	process := func(raw string) int {
		var input []*events.EventInput
		check(json.Unmarshal([]byte(raw), &input))
		if mode == "append" {
			out := make([]*events.Event, 0, len(input))
			for _, e := range input {
				if normalizeEvent(e) != nil {
					out = append(out, &events.Event{EventId: events.EventId{Id: uuid.New()}, EventInput: *e})
				}
			}
			proc.PersistEvents(out)
		} else {
			proc.processBatch(input)
		}
		return len(input)
	}
	latencies := make([]float64, 0, len(fixture.Batches))
	count := 0
	elapsed := 0.0
	if os.Getenv("POC_HTTP") == "1" {
		finished := make(chan struct{})
		var lock sync.Mutex
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			lock.Lock()
			defer lock.Unlock()
			if r.Method == "POST" && r.URL.Path == "/finish" {
				w.Write([]byte("{}"))
				close(finished)
				return
			}
			if r.Method != "POST" || r.URL.Path != "/events" {
				http.NotFound(w, r)
				return
			}
			data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8*1024*1024))
			if err != nil {
				http.Error(w, err.Error(), 400)
				return
			}
			start := time.Now()
			n := process(string(data))
			if r.URL.Query().Get("warmup") != "1" {
				count += n
				latencies = append(latencies, float64(time.Since(start).Nanoseconds())/1e6)
			}
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"persisted":%d}`, n)
		}))
		ready, err := json.Marshal(map[string]string{"url": server.URL})
		check(err)
		check(os.WriteFile(filepath.Join(dir, "ready.json"), ready, 0600))
		<-finished
		server.Close()
		for _, ms := range latencies {
			elapsed += ms / 1000
		}
	} else {
		for _, raw := range fixture.Warmup {
			process(raw)
		}
		start := time.Now()
		for _, raw := range fixture.Batches {
			batchStart := time.Now()
			count += process(raw)
			latencies = append(latencies, float64(time.Since(batchStart).Nanoseconds())/1e6)
		}
		elapsed = time.Since(start).Seconds()
	}
	var version, sqliteVersion string
	if !db.sqlite {
		check(db.db.QueryRow("select version()").Scan(&version))
	}
	check(app.Raw("select sqlite_version()").Scan(&sqliteVersion).Error)
	checkpointMs := 0.0
	if journal == "WAL" {
		start := time.Now()
		for _, connection := range sqliteDBs {
			var busy, logFrames, checkpointed int
			check(connection.QueryRow("PRAGMA wal_checkpoint(TRUNCATE)").Scan(&busy, &logFrames, &checkpointed))
			if busy != 0 {
				t.Fatal("Checkpoint blocked")
			}
		}
		checkpointMs = float64(time.Since(start).Nanoseconds()) / 1e6
	}
	// Reopen to verify committed persisted data, outside the timed region.
	db.close()
	adb, err = app.DB()
	check(err)
	check(adb.Close())
	db = openDB(dataPath)
	defer db.close()
	app, err = gorm.Open(sqlite.Open(pocSQLiteDSN(appPath)), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	check(err)
	adb, err = app.DB()
	check(err)
	defer adb.Close()
	read := func(d *sql.DB, q string) [][]any {
		if db.sqlite && d == db.db {
			for _, col := range []string{"timestamp", "first_seen", "last_seen"} {
				q = strings.ReplaceAll(q, "epoch_ms("+col+")", "CAST(round((julianday("+col+")-2440587.5)*86400000) AS INTEGER)")
			}
			q = strings.ReplaceAll(q, "='OBJECT'", "='object'")
		}
		rows, err := d.Query(q)
		check(err)
		defer rows.Close()
		cols, err := rows.Columns()
		check(err)
		out := make([][]any, 0)
		for rows.Next() {
			values, refs := make([]any, len(cols)), make([]any, len(cols))
			for i := range values {
				refs[i] = &values[i]
			}
			check(rows.Scan(refs...))
			for i, v := range values {
				if b, ok := v.([]byte); ok {
					values[i] = string(b)
				}
			}
			out = append(out, values)
		}
		check(rows.Err())
		return out
	}
	snapshot := map[string]any{
		"events":           read(db.db, "select epoch_ms(timestamp), event_type, session_id, person_id, cast(properties as varchar), cast(person_properties as varchar) from events"),
		"persons":          read(db.db, "select id, epoch_ms(first_seen), cast(properties as varchar), cast(property_timestamps as varchar) from persons"),
		"sessions":         read(db.db, "select id, person_id, epoch_ms(first_seen), epoch_ms(last_seen) from sessions"),
		"schemas":          read(adb, "select s.event_type, p.key, p.type, v.value from event_schemas s join event_schema_properties p on p.event_schema_id=s.id join event_schema_property_values v on v.event_schema_property_id=p.id"),
		"distinctIds":      read(db.db, "select count(distinct id) from events")[0][0],
		"jsonObjectEvents": read(db.db, "select count(*) from events where json_type(properties)='OBJECT' and json_type(person_properties)='OBJECT'")[0][0],
	}
	snapshotData, err := json.Marshal(snapshot)
	check(err)
	check(os.WriteFile(filepath.Join(dir, "snapshot.json"), snapshotData, 0600))
	slices.Sort(latencies)
	percentile := func(p float64) float64 { return latencies[min(len(latencies)-1, int(float64(len(latencies))*p))] }
	result := map[string]any{"implementation": "go-duckdb", "mode": mode, "events": count, "seconds": elapsed, "eventsPerSecond": float64(count) / elapsed, "batchP50Ms": percentile(.5), "batchP95Ms": percentile(.95), "batchP99Ms": percentile(.99), "runtime": runtime.Version(), "duckdb": version, "sqlite": sqliteVersion}
	if db.sqlite {
		result["implementation"] = "go-sqlite"
		result["duckdb"] = nil
	}
	result["duckdbStatementCache"] = !db.sqlite && pocDuckCacheEnabled()
	result["sqliteProfile"] = profile
	result["sqliteSettings"] = settings
	result["checkpointMs"] = checkpointMs
	result["eventsPerSecondIncludingCheckpoint"] = float64(count) / (elapsed + checkpointMs/1000)
	resultData, err := json.Marshal(result)
	check(err)
	check(os.WriteFile(filepath.Join(dir, "result.json"), resultData, 0600))
	fmt.Println(string(resultData))
}
