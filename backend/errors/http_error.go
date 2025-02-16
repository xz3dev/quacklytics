package errors

import (
	"go.uber.org/zap/zapcore"
)

type HttpError interface {
	GetLevel() zapcore.Level
	GetStatusCode() int
	Error() string
}
