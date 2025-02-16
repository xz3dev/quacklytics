package sv_mw

import (
	"github.com/go-chi/chi/middleware"
	"go.uber.org/zap"
	"net/http"
	"time"
)

// LoggerOpts contains the middleware configuration.
type LoggerOpts struct {
	// WithReferer enables logging the "Referer" HTTP header value.
	WithReferer bool

	// WithUserAgent enables logging the "User-Agent" HTTP header value.
	WithUserAgent bool
}

// Logger returns a logger middleware for chi, that implements the http.Handler interface.
func Logger(logger *zap.Logger, opts *LoggerOpts) func(next http.Handler) http.Handler {
	if logger == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	if opts == nil {
		opts = &LoggerOpts{}
	}
	return func(next http.Handler) http.Handler {
		fn := func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()
			defer func() {
				reqLogger := logger.With(
					zap.String("path", r.URL.Path),
					zap.Duration("lat", time.Since(t1)),
					zap.String("proto", r.Proto),
					zap.String("reqId", middleware.GetReqID(r.Context())),
					zap.Int("status", ww.Status()),
					zap.Int("size", ww.BytesWritten()),
				)
				if opts.WithReferer {
					ref := ww.Header().Get("Referer")
					if ref == "" {
						ref = r.Header.Get("Referer")
					}
					if ref != "" {
						reqLogger = reqLogger.With(zap.String("ref", ref))
					}
				}
				if opts.WithUserAgent {
					ua := ww.Header().Get("User-Agent")
					if ua == "" {
						ua = r.Header.Get("User-Agent")
					}
					if ua != "" {
						reqLogger = reqLogger.With(zap.String("ua", ua))
					}
				}
				lvl := zap.InfoLevel
				if ww.Status() == http.StatusUnauthorized {
					lvl = zap.WarnLevel
				} else if ww.Status() > 400 {
					lvl = zap.ErrorLevel
				}
				reqLogger.Log(lvl, http.StatusText(ww.Status()))
			}()
			next.ServeHTTP(ww, r)
		}
		return http.HandlerFunc(fn)
	}
}
