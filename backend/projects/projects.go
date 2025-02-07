package projects

import (
	"analytics/constants"
	"analytics/database/appdb"
	"analytics/log"
	"analytics/model"
	"os"
	"path/filepath"
	"strings"
)

func CreateDirectories() {
	dir := filepath.Dir(constants.DbDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}

	dir = filepath.Dir(constants.TmpDir)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		log.Fatal("Error creating directory for database: ", err)
	}
}

func ListProjects() []model.ProjectFiles {

	files, err := os.ReadDir(constants.DbDir)
	if err != nil {
		log.Fatal("Error reading directory: ", err)
	}

	projects := make([]model.ProjectFiles, 0)
	for _, file := range files {
		if !file.IsDir() && strings.HasPrefix(file.Name(), constants.DbProjectFilePrefix) {
			var projectName = strings.TrimSuffix(
				strings.TrimPrefix(file.Name(), constants.DbProjectFilePrefix),
				".db",
			)
			projects = append(projects, model.ProjectFiles{
				ID:              projectName,
				DbFile:          filepath.Join(constants.DbDir, file.Name()),
				AnalyticsDbFile: filepath.Join(constants.DbDir, constants.DbAnalyticsFilePrefix+projectName+".db"),
			})
		}
	}

	return projects
}

func Init() appdb.ProjectDBLookup {
	projectList := ListProjects()

	for _, project := range projectList {
		appdb.InitProjectDB(project)
	}

	return appdb.ProjectDBs
}
