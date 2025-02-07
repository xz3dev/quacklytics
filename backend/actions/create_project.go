package actions

import (
	"analytics/constants"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/model"
	"path/filepath"
)

func CreateProject(projectName string) model.ProjectFiles {
	project := model.ProjectFiles{
		ID:              projectName,
		DbFile:          filepath.Join(constants.DbDir, constants.DbProjectFilePrefix+projectName+".db"),
		AnalyticsDbFile: filepath.Join(constants.DbDir, constants.DbAnalyticsFilePrefix+projectName+".db"),
	}

	analyticsdb.InitProjectDB(project)
	appdb.InitProjectDB(project)

	return project
}
