package log

import (
	"github.com/volatiletech/authboss/v3"
	"go.uber.org/zap"
)

var (
	assertLogger                 = &abLogger{}
	_            authboss.Logger = assertLogger
)

type abLogger struct {
	*zap.Logger
}

var AuthbossLogger *abLogger

func (l *abLogger) Info(msg string) {
	if l.Logger != nil {
		l.Logger.Info(msg)
	}
}

func (l *abLogger) Error(msg string) {
	if l.Logger != nil {
		l.Logger.Error(msg)
	}
}
