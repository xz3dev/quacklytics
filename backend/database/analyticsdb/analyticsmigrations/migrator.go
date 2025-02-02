package analyticsmigrations

import (
	"analytics/log"
	"database/sql"
	"embed"
	"errors"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/atomic"
	"io/fs"
)

//go:embed *.sql
var embedMigrations embed.FS

func MigrateDBIfNeeded(db *sql.DB) {
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
	log.Info("Found %d migrations", len(files))
	m, err := migrate.NewWithInstance("iofs", fs, "data", &driver)

	//err = m.Down()
	//if err != nil && !errors.Is(err, migrate.ErrNoChange) {
	//	log.Fatal(err)
	//}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal(err.Error(), err)
	}
	log.Info("Migrated DuckDB to newest version successfully.")
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
