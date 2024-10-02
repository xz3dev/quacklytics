package database

import (
	"context"
	"database/sql"
	"log"
)

const DbFile = "_data/data.db"

var db *sql.DB

func Init() *sql.DB {
	var err error
	db, err = sql.Open("duckdb", DbFile+"?"+"access_mode=READ_WRITE")
	if err != nil {
		log.Fatal(err)
	}
	testdb()
	return db
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
