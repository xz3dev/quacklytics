package actions

import (
	"analytics/config"
	"analytics/cron"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/model"
	"analytics/projects"
	"gorm.io/gorm"
	"path/filepath"
)

func CreateProject(projectName string) model.ProjectFiles {
	project := model.ProjectFiles{
		ID:              projectName,
		DbFile:          filepath.Join(config.Config.Paths.Database, config.Config.Database.ProjectPrefix+projectName+".db"),
		AnalyticsDbFile: filepath.Join(config.Config.Paths.Database, config.Config.Database.AnalyticsPrefix+projectName+".db"),
	}

	db := appdb.InitProjectDB(project.ID, project.DbFile)
	analyticsdb.InitProjectDB(project.ID, project.AnalyticsDbFile)

	cron.InitProjectCron(project.ID, db, func(projectId string, db *gorm.DB) {
		GenerateParquetFiles(projectId, db)
	})

	return project
}

func CreateDefaultProject() {
	p := projects.ListProjects()
	if len(p) == 0 {
		CreateProject("default")
	}
}
