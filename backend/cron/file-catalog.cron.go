package cron

import (
	"github.com/go-co-op/gocron/v2"
	"gorm.io/gorm"
)

func InitProjectCron(projectId string, db *gorm.DB, taskFn func(string, *gorm.DB)) {
	task := gocron.NewTask(
		func(pid string, db *gorm.DB) {
			taskFn(pid, db)
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
