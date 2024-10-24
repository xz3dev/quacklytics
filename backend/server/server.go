package server

import (
	"analytics/server/routes"
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
	setupEventRoutes(mux)
	setupAnalyticsRoutes(mux)
	return mux
}

func setupEventRoutes(mux *chi.Mux) {
	mux.Get("/events", routes.QueryEvents)
	mux.Get("/events/parquet", routes.QueryEventAsParquet)
	mux.Post("/event", routes.AppendEvent)
	mux.Post("/dummy", routes.GenerateDummyEvents)
	mux.Get("/events/parquet/kw", routes.QueryEventsKW)
	mux.Get("/events/parquet/checksums", routes.LastTwelveWeeksChecksums)
}

func setupAnalyticsRoutes(mux *chi.Mux) {
	mux.Get("/dashboards", routes.Dashboards)
	mux.Post("/dashboards", routes.CreateDashboard)
	//mux.Get("/insights/", ListInsights)
	routes.SetupInsightRoutes(mux)
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
