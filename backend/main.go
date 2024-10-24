package main

import (
	"analytics/database/analyticsdb"
	"analytics/database/analyticsdb/analyticsmigrations"
	"analytics/database/applicationdb"
	"analytics/database/applicationdb/applicationdbmigrations"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {
	analyticsDb := analyticsdb.Init()
	analyticsmigrations.MigrateDBIfNeeded(analyticsDb)

	applicationDb := applicationdb.Init()
	applicationdbmigrations.MigrateDBIfNeeded(applicationDb)
	server.Start()
}
