package actions

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/projects"
	"path/filepath"
)

func CreateProject(projectName string) projects.ProjectFiles {
	project := projects.ProjectFiles{
		ID:              projectName,
		DbFile:          filepath.Join(projects.DbDir, projects.DbProjectFilePrefix+projectName+".db"),
		AnalyticsDbFile: filepath.Join(projects.DbDir, projects.DbAnalyticsFilePrefix+projectName+".db"),
	}

	analyticsdb.InitProjectDB(project)
	appdb.InitProjectDB(project)

	return project
}
