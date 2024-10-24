package server

import (
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"log"
	"net/http"
)

type Config struct {
	Port        int
	Url         string
	FrontendUrl string
}

func DefaultConfig() Config {
	return Config{
		Port:        3000,
		Url:         "http://localhost:3000",
		FrontendUrl: "http://localhost:3001",
	}
}

const port = 3000

func Start() {
	config := DefaultConfig()
	server := http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: setupMux(config),
	}

	log.Printf("Starting server on port %d", port)
	server.ListenAndServe()
}

func setupMux(c Config) *chi.Mux {
	mux := chi.NewMux()
	setupCORS(mux, c)
	setupMiddleware(mux)
	setupRoutes(mux)
	return mux
}

func setupRoutes(mux *chi.Mux) {
	mux.Get("/events", queryEvents)
	mux.Post("/event", receiveEvent)
	mux.Post("/dummy", generateDummyEvents)
	mux.Get("/events/parquet", queryEventAsParquet)
	mux.Get("/events/parquet/kw", queryEventsKW)
	mux.Get("/events/parquet/checksums", getLastTwelveWeeksChecksums)
	//mux.Get("/dashboards", getDashboards)
	//mux.Get("/insights", getInsights)
}

func setupMiddleware(r *chi.Mux) {
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
}

func setupCORS(mux *chi.Mux, c Config) {
	mux.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			c.FrontendUrl,
			c.Url,
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))
}
