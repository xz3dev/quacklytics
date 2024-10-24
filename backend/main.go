package main

import (
	"analytics/database/analyticsdb"
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/database/appdb"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {
	analyticsDb := analyticsdb.Init()
	analyticsmigrations.MigrateDBIfNeeded(analyticsDb)

	appdb.Init()
	server.Start()
}
