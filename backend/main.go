package main

import (
	"analytics/actions"
	"analytics/auth"
	"analytics/config"
	"analytics/cron"
	"analytics/database/appdb"
	"analytics/log"
	"analytics/model"
	"analytics/projects"
	"analytics/schema"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
	"gorm.io/gorm"
)

func main() {
	config.Load()
	log.Init()
	registerTables()
	projects.CreateDirectories()
	cron.Init()
	appDb := appdb.Init()
	projectDbs := projects.Init()

	initCronJobs(projectDbs)

	server.Start(appDb, projectDbs)
}

func initCronJobs(
	projectDbs appdb.ProjectDBLookup,
) {
	for projectId, db := range projectDbs {
		cron.InitProjectCron(projectId, db, func(projectId string, db *gorm.DB) {
			actions.GenerateParquetFiles(projectId, db)
		})
	}
}

func registerTables() {
	var projectTablesRegistry = []interface{}{
		&model.Dashboard{},
		&model.DashboardInsight{},
		&model.Insight{},
		&model.Series{},
		&schema.EventSchema{},
		&schema.EventSchemaProperty{},
		&schema.EventSchemaPropertyValue{},
		&model.InsightMeta{},
		&model.ProjectSetting{},
		&model.FileCatalogEntry{},
	}

	var appTablesRegistry = []interface{}{
		&auth.User{},
		&auth.RememberToken{},
		&auth.RecoveryToken{},
		&auth.RealtimeToken{},
	}
	appdb.RegisterTables(projectTablesRegistry, appTablesRegistry)
}
