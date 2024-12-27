package server

import (
	"analytics/auth"
	"analytics/database/appdb"
	sv_mw "analytics/server/middlewares"
	"analytics/server/routes"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/remember"
	"gorm.io/gorm"
	"log"
	"net/http"
)

var ab *authboss.Authboss

type Config struct {
	Port        int
	Url         string
	FrontendUrl string
}

func DefaultConfig() Config {
	return Config{
		Port:        3000,
		Url:         "http://localhost:3000",
		FrontendUrl: "http://localhost:5173",
	}
}

const port = 3000

func Start(appDb *gorm.DB, projectDbs appdb.ProjectDBLookup) {
	config := DefaultConfig()
	var err error
	ab, err = auth.SetupAuthboss(appDb)
	if err != nil {
		log.Fatal(err)
	}
	server := http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: setupMux(config, appDb, projectDbs),
	}

	log.Printf("Starting server on port %d", port)
	server.ListenAndServe()
}

func setupMux(c Config, db *gorm.DB, dbs appdb.ProjectDBLookup) *chi.Mux {
	mux := chi.NewMux()
	//setupCORS(mux, c)
	setupMiddleware(mux)

	mux.Mount("/api", http.StripPrefix("/api", buildRouter(db, dbs)))
	return mux
}

func buildRouter(appDb *gorm.DB, projectDbs appdb.ProjectDBLookup) *chi.Mux {
	mux := chi.NewMux()

	// Mount Authboss
	mux.Mount("/auth", http.StripPrefix("/auth", ab.Config.Core.Router))
	mux.Get("/auth/me", routes.CurrentUser)
	setupPublicEventRoutes(mux)

	mux.Group(func(mux chi.Router) {
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		setupProjectRoutes(mux)
	})

	// Use Authboss middleware for protected routes
	mux.Route("/{projectid}", func(mux chi.Router) {
		mux.Use(sv_mw.ProjectMiddleware(projectDbs))
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		mux.Post("/dummy", routes.GenerateDummyEvents)
		setupPrivateEventRoutes(mux)
		setupAnalyticsRoutes(mux)
	})

	return mux
}

func setupProjectRoutes(mux chi.Router) {
	mux.Get("/projects", routes.ListProjects)
}

func setupPublicEventRoutes(mux chi.Router) {
	mux.Post("/event", routes.AppendEvent)
}

func setupPrivateEventRoutes(mux chi.Router) {
	mux.Get("/events", routes.QueryEvents)
	mux.Get("/events/parquet", routes.QueryEventAsParquet)
	mux.Post("/event", routes.AppendEvent)
	mux.Get("/events/parquet/kw", routes.QueryEventsKW)
	mux.Get("/events/parquet/checksums", routes.LastTwelveWeeksChecksums)
}

func setupAnalyticsRoutes(mux chi.Router) {
	mux.Get("/dashboards", routes.Dashboards)
	mux.Post("/dashboards", routes.CreateDashboard)
	mux.Get("/schema", routes.Schema)
	//mux.Get("/insights/", ListInsights)
	routes.SetupInsightRoutes(mux)
}

func setupMiddleware(r *chi.Mux) {
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(ab.LoadClientStateMiddleware)
	r.Use(remember.Middleware(ab))
	r.Use(sv_mw.AuthbossMW(ab))
}

func setupCORS(mux *chi.Mux, c Config) {
	mux.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			c.FrontendUrl,
			c.Url,
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Set-Cookie"},
		ExposedHeaders:   []string{"Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))
}
