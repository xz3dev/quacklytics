package analyticsdb

import (
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/projects"
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"github.com/marcboeker/go-duckdb"
	"log"
)

const (
	DbFile       = "_data/data.db"
	DbDir        = "_data"
	DbFilePrefix = "analytics_"
)

type DBConnection struct {
	db         *sql.DB
	connection driver.Conn
}

var I2 = make(map[string]*DBConnection)

func Appender(projectID string, table string) *duckdb.Appender {
	proj, exists := I2[projectID]
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
	proj, exists := I2[projectID]
	if !exists {
		return nil, fmt.Errorf("project connection not found: %s", projectID)
	}
	return proj.db.BeginTx(context.Background(), nil)
}

func InitProjects() {
	projectList := projects.ListProjects()

	for _, project := range projectList {
		if err := InitProjectDB(project); err != nil {
			log.Printf("Error initializing project DB %s: %v", project.ID, err)
		}
	}
}

func InitProjectDB(project projects.ProjectFiles) error {
	connector, err := duckdb.NewConnector(project.AnalyticsDbFile+"?"+"access_mode=READ_WRITE", nil)
	if err != nil {
		return err
	}

	con, err := connector.Connect(context.Background())
	if err != nil {
		return err
	}

	projectDB := sql.OpenDB(connector)

	I2[project.ID] = &DBConnection{
		db:         projectDB,
		connection: con,
	}

	if err := testProjectDB(projectDB); err != nil {
		return err
	}

	analyticsmigrations.MigrateDBIfNeeded(projectDB)

	log.Printf("Initialized DuckDB for project: %s", project.ID)
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
