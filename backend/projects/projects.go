package projects

import (
	"log"
	"os"
	"path/filepath"
	"strings"
)

const DbProjectFilePrefix = "project_"
const DbAnalyticsFilePrefix = "analytics_"
const DbDir = "_data"
const TmpDir = "_tmp"

func CreateDirectories() {
	dir := filepath.Dir(DbDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	dir = filepath.Dir(TmpDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}
}

func ListProjects() []ProjectFiles {

	files, err := os.ReadDir(DbDir)
	if err != nil {
		log.Fatal("Error reading directory: ", err)
	}

	projects := make([]ProjectFiles, 0)
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), DbProjectFilePrefix) {
			var projectName = strings.TrimSuffix(
				strings.TrimPrefix(file.Name(), DbProjectFilePrefix),
				".db",
			)
			projects = append(projects, ProjectFiles{
				ID:              projectName,
				DbFile:          filepath.Join(DbDir, file.Name()),
				AnalyticsDbFile: filepath.Join(DbDir, DbAnalyticsFilePrefix+projectName+".db"),
			})
		}
	}

	return projects
}

type ProjectFiles struct {
	ID              string `json:"id"`
	DbFile          string `json:"dbFile"`
	AnalyticsDbFile string `json:"analyticsDbFile"`
}
