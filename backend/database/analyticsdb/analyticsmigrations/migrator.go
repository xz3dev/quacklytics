package analyticsmigrations

import (
	"analytics/internal/log"
	"database/sql"
	"embed"
	"errors"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/atomic"
	"io/fs"
	"strings"
)

//go:embed *.sql
var embedMigrations embed.FS

func MigrateDBIfNeeded(id string, db *sql.DB) {
	log.Info("------ Migrating analytics: %s------", id)
	files, err := getAllFilenames(&embedMigrations)
	if err != nil {
		log.Fatal(err.Error(), err)
	}
	fs, err := iofs.New(embedMigrations, ".")
	if err != nil {
		log.Fatal(err.Error(), err)
	}
	isLocked := atomic.Bool{}
	isLocked.Store(false)
	driver := DuckDB{
		db:       db,
		isLocked: isLocked,
	}
	driver.ensureVersionTable()
	upMigrationCount := 0
	for _, file := range files {
		if strings.Contains(file, "up.sql") {
			upMigrationCount++
		}
	}
	log.Info("Found %d 'up'-migrations", upMigrationCount)
	m, err := migrate.NewWithInstance("iofs", fs, "data", &driver)

	//err = m.Down()
	//if err != nil && !errors.Is(err, migrate.ErrNoChange) {
	//	log.Fatal(err)
	//}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal(err.Error(), err)
	}
	log.Info("------ End migrating analytics: %s ------", id)
}

func getAllFilenames(efs *embed.FS) (files []string, err error) {
	if err := fs.WalkDir(efs, ".", func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			return nil
		}

		files = append(files, path)

		return nil
	}); err != nil {
		return nil, err
	}

	return files, nil
}
