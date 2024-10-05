package database

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"github.com/marcboeker/go-duckdb"
	"log"
)

const DbFile = "_data/data.db"

var db *sql.DB
var connection driver.Conn

var readOnlyDb *sql.DB
var readOnlyConnection driver.Conn

func Appender(table string) *duckdb.Appender {
	appender, err := duckdb.NewAppenderFromConn(connection, "", table)
	if err != nil {
		log.Fatal("Error while creating duckdb appender: ", err)
	}
	return appender
}

func ReadOnlyTx() (*sql.Tx, error) {
	tx, err := readOnlyDb.BeginTx(context.Background(), nil)
	if err != nil {
		log.Println(err)
	}
	return tx, err
}

func Tx() (*sql.Tx, error) {
	tx, err := db.BeginTx(context.Background(), nil)
	return tx, err
}

func Init() *sql.DB {
	var err error
	connector, err := duckdb.NewConnector(DbFile+"?"+"access_mode=READ_WRITE", nil)
	if err != nil {
		log.Fatal("Error while initialising connector", err)
	}
	con, err := connector.Connect(context.Background())
	if err != nil {
		log.Fatal("Error while creating db connection: ", err)
	}
	connection = con
	db = sql.OpenDB(connector)
	testdb()
	initReadOnlyDb()
	return db
}

func initReadOnlyDb() {
	var err error
	connector, err := duckdb.NewConnector(DbFile+"?"+"access_mode=READ_ONLY", nil)
	if err != nil {
		log.Fatal("Error while initialising connector", err)
	}
	con, err := connector.Connect(context.Background())
	if err != nil {
		log.Fatal("Error while creating db connection: ", err)
	}
	readOnlyConnection = con
	readOnlyDb = sql.OpenDB(connector)
}

func testdb() {
	check(db.Ping())
	setting := db.QueryRowContext(context.Background(), "select current_setting('access_mode')")
	var am string
	check(setting.Scan(&am))
	log.Printf("db opened with access mode %s", am)
}

func check(args ...interface{}) {
	err := args[len(args)-1]
	if err != nil {
		panic(err)
	}
}
