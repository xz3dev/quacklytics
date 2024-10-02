package main

import (
	"analytics/database"
	"analytics/database/migrations"
	"analytics/server"
	_ "github.com/marcboeker/go-duckdb"
)

func main() {
	db := database.Init()
	migrations.MigrateDBIfNeeded(db)
	server.Start()
}
