package applicationdbmigrations

import (
	"database/sql"
	"embed"
	"errors"
	"io/fs"
	"log"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
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

	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		log.Fatal(err)
	}

	m, err := migrate.NewWithInstance("iofs", fs, "main", driver)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Found %d sqlite migrations", len(files))

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
