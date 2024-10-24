package applicationdb

import (
	"context"
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

const DbFile = "_data/app.db"

var db *sql.DB

func Init() *sql.DB {
	// Ensure the directory exists
	dir := filepath.Dir(DbFile)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	// Open the SQLite database
	var err error
	db, err = sql.Open("sqlite3", DbFile)
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}

	// Verify the connection
	err = db.Ping()
	if err != nil {
		log.Fatal("Error connecting to database: ", err)
	}

	log.Println("Successfully connected to SQLite database")

	return db
}

func Tx() (*sql.Tx, error) {
	tx, err := db.BeginTx(context.Background(), nil)
	return tx, err
}
