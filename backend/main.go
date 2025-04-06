package main

import (
	"analytics/auth"
	"analytics/config"
	"analytics/cron"
	"analytics/database/appdb"
	"analytics/domain/apikeys"
	"analytics/domain/dashboards"
	"analytics/domain/events/parquet"
	"analytics/domain/filecatalog"
	"analytics/domain/insightmeta"
	"analytics/domain/insights"
	"analytics/domain/projects"
	"analytics/domain/schema"
	"analytics/log"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
	"gorm.io/gorm"
	"os"
)

func main() {
	os.Setenv("TZ", "Etc/UTC")

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
	projectDbs *appdb.ProjectDBLookup,
) {
	for projectId, db := range *projectDbs {
		cron.InitProjectCron(projectId, db, func(projectId string, db *gorm.DB) {
			parquet.GenerateParquetFiles(projectId, db)
		})
	}
}

func registerTables() {
	var projectTablesRegistry = []interface{}{
		&dashboards.Dashboard{},
		&dashboards.DashboardInsight{},
		&insights.Insight{},
		&schema.EventSchema{},
		&schema.EventSchemaProperty{},
		&schema.EventSchemaPropertyValue{},
		&insightmeta.InsightMeta{},
		&projects.ProjectSetting{},
		&filecatalog.FileCatalogEntry{},
	}

	var appTablesRegistry = []interface{}{
		&auth.User{},
		&auth.RememberToken{},
		&auth.RecoveryToken{},
		&auth.RealtimeToken{},
		&apikeys.ApiKey{},
	}
	appdb.RegisterTables(projectTablesRegistry, appTablesRegistry)
}
