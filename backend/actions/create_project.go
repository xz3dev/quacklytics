package actions

import (
	"analytics/config"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/model"
	"path/filepath"
)

func CreateProject(projectName string) model.ProjectFiles {
	project := model.ProjectFiles{
		ID:              projectName,
		DbFile:          filepath.Join(config.Config.Paths.Database, config.Config.Database.ProjectPrefix+projectName+".db"),
		AnalyticsDbFile: filepath.Join(config.Config.Paths.Database, config.Config.Database.AnalyticsPrefix+projectName+".db"),
	}

	analyticsdb.InitProjectDB(project)
	appdb.InitProjectDB(project)

	return project
}
