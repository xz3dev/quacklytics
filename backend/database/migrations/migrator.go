package migrations

import (
	"database/sql"
	"embed"
	"errors"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/atomic"
	"io/fs"
	"log"
)

//go:embed *.sql
var embedMigrations embed.FS

func MigrateDBIfNeeded(db *sql.DB) {
	files, err := getAllFilenames(&embedMigrations)
	if err != nil {
		log.Fatal(err)
	}
	fs, err := iofs.New(embedMigrations, ".")
	if err != nil {
		log.Fatal(err)
	}
	isLocked := atomic.Bool{}
	isLocked.Store(false)
	driver := DuckDB{
		db:       db,
		isLocked: isLocked,
	}
	driver.ensureVersionTable()
	m, err := migrate.NewWithInstance("iofs", fs, "data", &driver)
	log.Printf("Found %d migrations", len(files))

	//err = m.Down()
	//if err != nil && !errors.Is(err, migrate.ErrNoChange) {
	//	log.Fatal(err)
	//}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal(err)
	}

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
