package cron

import (
	"analytics/log"
	"github.com/go-co-op/gocron/v2"
	"go.uber.org/zap"
)

var Scheduler gocron.Scheduler

func Init() {
	var err error
	Scheduler, err = gocron.NewScheduler(
		gocron.WithLogger(&cronLogger{}),
	)
	if err != nil {
		panic(err)
	}

	Scheduler.Start()
}

var _ gocron.Logger = &cronLogger{}

type cronLogger struct{}

func logger() *zap.SugaredLogger {
	return log.
		Logger.
		Sugar()
}

func (c cronLogger) Debug(msg string, args ...any) {
	logger().Debugf(msg, args...)
}

func (c cronLogger) Info(msg string, args ...any) {
	logger().Infof(msg, args...)
}

func (c cronLogger) Warn(msg string, args ...any) {
	logger().Warnf(msg, args...)
}

func (c cronLogger) Error(msg string, args ...any) {
	logger().Errorf(msg, args...)
}
