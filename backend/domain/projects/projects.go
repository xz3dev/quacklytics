package projects

import (
	"analytics/config"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/internal/log"
	"os"
	"path/filepath"
	"strings"
)

func CreateDirectories() {
	dir := filepath.Dir(config.Config.Paths.Database)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	dir = filepath.Dir(config.Config.Paths.Parquet)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}
}

func ListProjects() []ProjectFiles {
	files, err := os.ReadDir(config.Config.Paths.Database)
	if err != nil {
		log.Fatal("Error reading directory: ", err)
	}

	projects := make([]ProjectFiles, 0)
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), config.Config.Database.ProjectPrefix) {
			var projectName = strings.TrimSuffix(
				strings.TrimPrefix(file.Name(), config.Config.Database.ProjectPrefix),
				".db",
			)
			projects = append(projects, ProjectFiles{
				ID:              projectName,
				DbFile:          filepath.Join(config.Config.Paths.Database, file.Name()),
				AnalyticsDbFile: filepath.Join(config.Config.Paths.Database, config.Config.Database.AnalyticsPrefix+projectName+".db"),
			})
		}
	}

	return projects
}

func Init() *appdb.ProjectDBLookup {
	projectList := ListProjects()

	for _, project := range projectList {
		appdb.InitProjectDB(project.ID, project.DbFile)
		analyticsdb.InitProjectDB(project.ID, project.AnalyticsDbFile)
	}

	return &appdb.ProjectDBs
}
