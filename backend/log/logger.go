package log

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Logger *zap.Logger
var sugar *zap.SugaredLogger

func Init() {
	var err error
	config := zap.NewDevelopmentConfig()
	config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	Logger, err = config.Build(
		zap.AddCallerSkip(1),
	)
	if err != nil {
		panic("failed to initialize zap logger: " + err.Error())
	}
	defer Logger.Sync()

	sugar = Logger.Sugar()

	AuthbossLogger = &abLogger{Logger: sugar.WithOptions(zap.AddCallerSkip(1))}
	zap.ReplaceGlobals(Logger)
}

func Info(msg string, fields ...any) {
	sugar.Infof(msg, fields...)
}

func Debug(msg string, fields ...any) {
	sugar.Debugf(msg, fields...)
}

func Warn(msg string, fields ...any) {
	sugar.Warnf(msg, fields...)
}

func Error(msg string, fields ...any) {
	sugar.Errorf(msg, fields...)
}

func Fatal(msg string, fields ...any) {
	sugar.Fatalf(msg, fields...)
}

func Panic(msg string, fields ...any) {
	sugar.Panicf(msg, fields...)
}
