package server

import (
	"github.com/rs/cors"
	"net/http"
)

func setupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /event", receiveEvent)
	mux.HandleFunc("GET /events", queryEvents)
	mux.HandleFunc("POST /dummy", generateDummyEvents)
}

func setupCORS(c Config) *cors.Cors {
	co := cors.Options{
		AllowedOrigins: []string{
			c.FrontendUrl,
			c.Url,
		},
		AllowCredentials: true,
		// Enable Debugging for testing, consider disabling in production
		Debug: false,
	}
	return cors.New(co)
}
