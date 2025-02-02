package main

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/projects"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {
	projects.CreateDirectories()
	appDb := appdb.Init()
	projectDbs := appdb.InitProjects()
	analyticsdb.InitProjects()

	server.Start(appDb, projectDbs)
}
