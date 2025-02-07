package main

import (
	"analytics/cron"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/log"
	"analytics/projects"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {
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
		cron.InitCatalogCron(projectId, db)
	}
}
