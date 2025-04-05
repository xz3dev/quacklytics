package testsetup

import (
	"analytics/database/analyticsdb"
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/log"
	"context"
	"database/sql"
	"database/sql/driver"
	"github.com/marcboeker/go-duckdb"
	"github.com/zeebo/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"testing"
)

func createTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to create test database: %v", err)
	}
	return db
}

func createTestAnalyticsDB(t *testing.T) TestDuckDB {
	connector, err := duckdb.NewConnector("", nil)
	assert.NoError(t, err)

	con, err := connector.Connect(context.Background())
	assert.NoError(t, err)

	db := sql.OpenDB(connector)

	analyticsmigrations.MigrateDBIfNeeded("test-memory-db", db)

	return TestDuckDB{
		db:         sql.OpenDB(connector),
		connection: con,
	}
}

type TestDuckDB struct {
	db         *sql.DB
	connection driver.Conn
}

func (c *TestDuckDB) Appender(table string) analyticsdb.DuckDBAppender {
	appender, err := duckdb.NewAppenderFromConn(c.connection, "", table)
	if err != nil {
		log.Fatal("Error while creating duckdb appender: ", err)
	}
	return appender
}

func (c *TestDuckDB) Tx() (*sql.Tx, error) {
	return c.db.BeginTx(context.Background(), nil)
}

func (c *TestDuckDB) Close() {
	c.connection.Close()
	c.db.Close()
}
