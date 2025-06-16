package sv_mw

import (
	"compress/gzip"
	"io"
	"net/http"
)

func DecompressionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("compression") == "gzip-js" || r.Header.Get("Content-Encoding") == "gzip" {
			gzipReader, err := gzip.NewReader(r.Body)
			if err != nil {
				http.Error(w, "Unable to create gzip reader", http.StatusBadRequest)
				return
			}
			// Replace the request Body with the decompressed stream.
			r.Body = io.NopCloser(gzipReader)
		}
		next.ServeHTTP(w, r)
	})
}
