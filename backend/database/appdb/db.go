package appdb

import (
	"analytics/auth"
	"analytics/model"
	"analytics/schema"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"log"
	"os"
	"path/filepath"
	"strings"
)

const DbFile = "_data/app.db"

const DbFilePrefix = "project_"
const DbDir = "_data"

type ProjectDBLookup = map[string]*gorm.DB

var ProjectDBs ProjectDBLookup = make(ProjectDBLookup)

var projectTables = []interface{}{
	&model.Dashboard{},
	&model.Insight{},
	&model.Series{},
	&schema.EventSchema{},
	&schema.EventSchemaProperty{},
	&schema.EventSchemaPropertyValue{},
	&model.InsightMeta{},
}

var appTables = []interface{}{
	&auth.User{},
	&auth.RememberToken{},
	&auth.RecoveryToken{},
}

func InitProjects() ProjectDBLookup {
	// Ensure the directory exists
	dir := filepath.Dir(DbDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	// list all files in the directory
	files, err := os.ReadDir(DbDir)
	if err != nil {
		log.Fatal("Error reading directory: ", err)
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), DbFilePrefix) {
			var projectName = strings.TrimSuffix(
				strings.TrimPrefix(file.Name(), DbFilePrefix),
				".db",
			)
			var err error
			ProjectDBs[projectName], err = gorm.Open(sqlite.Open(filepath.Join(DbDir, file.Name())), &gorm.Config{})
			if err != nil {
				log.Fatal("Error opening database: ", err)
			}
			log.Printf("Opened DB for project: %s", projectName)
			ProjectDBs[projectName].AutoMigrate(projectTables...)
			log.Printf("Migrated DB for project: %s", projectName)
		}
	}

	return ProjectDBs
}

func Init() *gorm.DB {
	// Ensure the directory exists
	dir := filepath.Dir(DbDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	// Open the SQLite database using GORM
	var err error
	appDb, err := gorm.Open(sqlite.Open(DbFile), &gorm.Config{})
	if err != nil {
		log.Fatal("Erxror opening database: ", err)
	}

	// Auto Migrate the schema
	err = appDb.AutoMigrate(appTables...)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}

	log.Println("Successfully connected to SQLite database and migrated schema")

	return appDb
}
