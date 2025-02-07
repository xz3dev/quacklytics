package cron

import (
	"analytics/filecatalog"
	"github.com/go-co-op/gocron/v2"
	"gorm.io/gorm"
)

func InitCatalogCron(projectId string, db *gorm.DB) {
	task := gocron.NewTask(
		func(pid string, db *gorm.DB) {
			filecatalog.GenerateParquetFiles(projectId, db)
		},
		projectId,
		db,
	)
	Scheduler.NewJob(
		gocron.DailyJob(1,
			gocron.NewAtTimes(
				gocron.NewAtTime(0, 0, 0),
			),
		),
		task,
	)
	Scheduler.NewJob(
		gocron.OneTimeJob(gocron.OneTimeJobStartImmediately()),
		task,
	)
}
