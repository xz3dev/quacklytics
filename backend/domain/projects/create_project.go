package projects

import (
	"analytics/config"
	"analytics/cron"
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/domain/dashboards"
	"analytics/domain/events/parquet"
	"errors"
	"gorm.io/gorm"
	"path/filepath"
	"regexp"
)

var pattern = regexp.MustCompile("^[a-zA-Z0-9_-]+$")

func CreateProject(projectName string) (ProjectFiles, error) {
	if !pattern.MatchString(projectName) {
		return ProjectFiles{}, errors.New("project name must only contain letters, numbers, underscores and dashes")
	}
	project := ProjectFiles{
		ID:              projectName,
		DbFile:          filepath.Join(config.Config.Paths.Database, config.Config.Database.ProjectPrefix+projectName+".db"),
		AnalyticsDbFile: filepath.Join(config.Config.Paths.Database, config.Config.Database.AnalyticsPrefix+projectName+".db"),
	}

	db := appdb.InitProjectDB(project.ID, project.DbFile)
	analyticsdb.InitProjectDB(project.ID, project.AnalyticsDbFile)
	if _, err := dashboards.EnsureDefaultDashboard(db); err != nil {
		return ProjectFiles{}, err
	}

	cron.InitProjectCron(project.ID, db, func(projectId string, db *gorm.DB) {
		parquet.GenerateParquetFiles(projectId, db)
	})

	return project, nil
}

func CreateDefaultProject() {
	p := ListProjects()
	if len(p) == 0 {
		CreateProject("default")
	}
}
