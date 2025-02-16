package analyticsdb

import (
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/log"
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"github.com/marcboeker/go-duckdb"
)

type DBConnection struct {
	db         *sql.DB
	connection driver.Conn
}

var LookupTable = make(map[string]*DBConnection)

func Appender(projectID string, table string) *duckdb.Appender {
	proj, exists := LookupTable[projectID]
	if !exists {
		log.Fatal("Project connection not found: ", projectID)
	}
	appender, err := duckdb.NewAppenderFromConn(proj.connection, "", table)
	if err != nil {
		log.Fatal("Error while creating duckdb appender: ", err)
	}
	return appender
}

func Tx(projectID string) (*sql.Tx, error) {
	proj, exists := LookupTable[projectID]
	if !exists {
		return nil, fmt.Errorf("project connection not found: %s", projectID)
	}
	return proj.db.BeginTx(context.Background(), nil)
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

	LookupTable[projectId] = &DBConnection{
		db:         projectDB,
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
