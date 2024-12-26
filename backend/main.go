package main

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {

	appDb := appdb.Init()
	projectDbs := appdb.InitProjects()
	analyticsdb.InitProjects()
	server.Start(appDb, projectDbs)
}
