package auth

import (
	"analytics/internal/log"
	errors2 "analytics/server/errors"
	"errors"
	"fmt"
	"github.com/volatiletech/authboss/v3"
	"go.uber.org/zap/zapcore"
	"net/http"
)

type ABErrorHandler struct{}

func (e ABErrorHandler) Wrap(handler func(w http.ResponseWriter, r *http.Request) error) http.Handler {
	return errorHandler{
		Handler:   handler,
		LogWriter: log.AuthbossLogger,
	}
}

type errorHandler struct {
	Handler   func(w http.ResponseWriter, r *http.Request) error
	LogWriter authboss.Logger
}

func (e errorHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	err := e.Handler(w, r)
	if err == nil {
		return
	}

	var logLevelError errors2.HttpError
	if errors.As(err, &logLevelError) {
		lvl := logLevelError.GetLevel()
		log.AuthbossLogger.Logger.Log(lvl, fmt.Sprintf("request error from (%s) %s: %s", r.RemoteAddr, r.URL.String(), err.Error()))
		if lvl >= zapcore.ErrorLevel {
			status := logLevelError.GetStatusCode()
			if status == 0 {
				status = http.StatusInternalServerError
			}
			http.Error(w, err.Error(), status)
		}
		return
	}

	e.LogWriter.Error(fmt.Sprintf("request error from (%s) %s: %+v", r.RemoteAddr, r.URL.String(), err))
	http.Error(w, err.Error(), http.StatusInternalServerError)
}
