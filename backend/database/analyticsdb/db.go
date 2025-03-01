package analyticsdb

import (
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/log"
	"context"
	"database/sql"
	"database/sql/driver"
	"github.com/marcboeker/go-duckdb"
)

type DuckDB interface {
	Appender(table string) DuckDBAppender
	Tx() (*sql.Tx, error)
}
type DuckDBConnection struct {
	Db         *sql.DB
	connection driver.Conn
}

var LookupTable = make(map[string]*DuckDBConnection)

func (c *DuckDBConnection) Appender(table string) DuckDBAppender {
	appender, err := duckdb.NewAppenderFromConn(c.connection, "", table)
	if err != nil {
		log.Fatal("Error while creating duckdb appender: ", err)
	}
	return appender
}

func (c *DuckDBConnection) Tx() (*sql.Tx, error) {
	return c.Db.BeginTx(context.Background(), nil)
}

func InitProjectDB(projectId string, analyticsDbFilePath string) error {
	connector, err := duckdb.NewConnector(analyticsDbFilePath+"?"+"access_mode=READ_WRITE", nil)
	if err != nil {
		return err
	}

	con, err := connector.Connect(context.Background())
	if err != nil {
		return err
	}

	projectDB := sql.OpenDB(connector)

	LookupTable[projectId] = &DuckDBConnection{
		Db:         projectDB,
		connection: con,
	}

	if err := testProjectDB(projectDB); err != nil {
		return err
	}

	analyticsmigrations.MigrateDBIfNeeded(projectId, projectDB)

	return nil
}

func testProjectDB(db *sql.DB) error {
	if err := db.Ping(); err != nil {
		return err
	}

	var am string
	err := db.QueryRowContext(
		context.Background(),
		"select current_setting('access_mode')",
	).Scan(&am)

	if err != nil {
		return err
	}

	return nil
}

func check(args ...interface{}) {
	err := args[len(args)-1]
	if err != nil {
		panic(err)
	}
}
