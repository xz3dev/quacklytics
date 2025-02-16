package main

import (
	"analytics/config"
	"analytics/cron"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/filecatalog"
	"analytics/log"
	"analytics/projects"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
	"gorm.io/gorm"
)

func main() {
	config.Load()
	log.Init()
	projects.CreateDirectories()
	cron.Init()
	appDb := appdb.Init()
	projectDbs := projects.Init()
	analyticsdb.InitProjects()

	initCronJobs(projectDbs)

	server.Start(appDb, projectDbs)
}

func initCronJobs(
	projectDbs appdb.ProjectDBLookup,
) {
	for projectId, db := range projectDbs {
		cron.InitProjectCron(projectId, db, func(projectId string, db *gorm.DB) {
			filecatalog.GenerateParquetFiles(projectId, db)
		})
	}
}
