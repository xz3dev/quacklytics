package appdb

import (
	"analytics/config"
	"analytics/log"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"os"
	"path/filepath"
)

const DbFile = "_data/app.db"

type ProjectDBLookup = map[string]*gorm.DB

var ProjectDBs = make(ProjectDBLookup)

var appTablesRegistry []interface{}
var projectTablesRegistry []interface{}

func RegisterTables(projectTables []interface{}, appTables []interface{}) {
	projectTablesRegistry = make([]interface{}, len(projectTables))
	appTablesRegistry = make([]interface{}, len(appTables))
	copy(projectTablesRegistry, projectTables)
	copy(appTablesRegistry, appTables)
}

func InitProjectDB(projectId string, projectDbFilePath string) *gorm.DB {
	var err error
	ProjectDBs[projectId], err = gorm.Open(sqlite.Open(projectDbFilePath), &gorm.Config{})
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}
	log.Info("----- Initializing DB for project: %s -----", projectId)
	err = ProjectDBs[projectId].AutoMigrate(projectTablesRegistry...)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}
	log.Info("Migrated DB for project: %s", projectId)
	log.Info("----- End initializing DB for project: %s -----", projectId)
	return ProjectDBs[projectId]
}

func Init() *gorm.DB {
	// Ensure the directory exists
	dir := filepath.Dir(config.Config.Paths.Database)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	// Open the SQLite database using GORM
	var err error
	appDb, err := gorm.Open(sqlite.Open(DbFile), &gorm.Config{})
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}

	// Auto Migrate the schema
	err = appDb.AutoMigrate(appTablesRegistry...)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}

	log.Info("Successfully connected to non project-specific app database and migrated schema")

	return appDb
}
