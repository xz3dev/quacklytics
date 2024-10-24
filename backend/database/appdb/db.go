package appdb

import (
	"analytics/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"log"
	"os"
	"path/filepath"
)

const DbFile = "_data/app.db"

var I *gorm.DB

func Init() *gorm.DB {
	// Ensure the directory exists
	dir := filepath.Dir(DbFile)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	// Open the SQLite database using GORM
	var err error
	I, err = gorm.Open(sqlite.Open(DbFile), &gorm.Config{})
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}

	// Auto Migrate the schema
	err = I.AutoMigrate(
		&model.Project{},
		&model.Dashboard{},
		&model.Insight{},
		&model.Series{},
	)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}

	log.Println("Successfully connected to SQLite database and migrated schema")

	return I
}

func Tx() (*gorm.DB, error) {
	return I.Begin(), nil
}
