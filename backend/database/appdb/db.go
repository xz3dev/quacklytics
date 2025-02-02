package appdb

import (
	"analytics/auth"
	"analytics/log"
	"analytics/model"
	"analytics/projects"
	"analytics/schema"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"os"
	"path/filepath"
)

const DbFile = "_data/app.db"

const DbFilePrefix = "project_"
const DbDir = "_data"

type ProjectDBLookup = map[string]*gorm.DB

var ProjectDBs ProjectDBLookup = make(ProjectDBLookup)

var projectTables = []interface{}{
	&model.Dashboard{},
	&model.DashboardInsight{},
	&model.Insight{},
	&model.Series{},
	&schema.EventSchema{},
	&schema.EventSchemaProperty{},
	&schema.EventSchemaPropertyValue{},
	&model.InsightMeta{},
	&projects.ProjectSetting{},
}

var appTables = []interface{}{
	&auth.User{},
	&auth.RememberToken{},
	&auth.RecoveryToken{},
}

func InitProjects() ProjectDBLookup {
	projectList := projects.ListProjects()

	for _, project := range projectList {
		InitProjectDB(project)
	}

	return ProjectDBs
}

func InitProjectDB(project projects.ProjectFiles) {
	var err error
	ProjectDBs[project.ID], err = gorm.Open(sqlite.Open(project.DbFile), &gorm.Config{})
	if err != nil {
		log.Fatal("Error opening database: ", err)
	}
	log.Info("----- Initializing DB for project: %s -----", project.ID)
	err = ProjectDBs[project.ID].AutoMigrate(projectTables...)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}
	log.Info("Migrated DB for project: %s", project.ID)
	log.Info("----- End initializing DB for project: %s -----", project.ID)
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
		log.Fatal("Error opening database: ", err)
	}

	// Auto Migrate the schema
	err = appDb.AutoMigrate(appTables...)
	if err != nil {
		log.Fatal("Error migrating database: ", err)
	}

	log.Info("Successfully connected to non project-specific app database and migrated schema")

	return appDb
}
