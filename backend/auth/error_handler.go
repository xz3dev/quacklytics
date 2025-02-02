package auth

import (
	"analytics/log"
	"fmt"
	"github.com/volatiletech/authboss/v3"
	"net/http"
)

type ABErrorHandler struct{}

func (e ABErrorHandler) Wrap(f func(w http.ResponseWriter, r *http.Request) error) http.Handler {
	return errorHandler{
		Handler:   f,
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

	e.LogWriter.Error(fmt.Sprintf("request error from (%s) %s: %+v", r.RemoteAddr, r.URL.String(), err))
	http.Error(w, err.Error(), http.StatusInternalServerError)
}
