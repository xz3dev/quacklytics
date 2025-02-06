package server

import (
	"analytics/auth"
	"analytics/database/appdb"
	"analytics/log"
	svmw "analytics/server/middlewares"
	"analytics/server/routes"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/remember"
	"go.uber.org/zap"
	"gorm.io/gorm"
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
		log.Fatal(err.Error(), err)
	}
	server := http.Server{
		Addr:     fmt.Sprintf(":%d", config.Port),
		Handler:  setupMux(projectDbs, appDb),
		ErrorLog: zap.NewStdLog(log.Logger),
	}

	log.Info("Starting server on port %d", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err.Error(), err)
	}
}

func setupMux(dbs appdb.ProjectDBLookup, appdb *gorm.DB) *chi.Mux {
	mux := chi.NewMux()
	setupMiddleware(mux, dbs, appdb)

	mux.Mount("/api", http.StripPrefix("/api", buildRouter(dbs)))
	return mux
}

func buildRouter(projectDbs appdb.ProjectDBLookup) *chi.Mux {
	mux := chi.NewMux()

	// Mount Authboss
	mux.Mount("/auth", http.StripPrefix("/auth", ab.Config.Core.Router))
	//mux.Post("/auth/register", routes.RegisterUser)
	mux.Get("/auth/me", routes.CurrentUser)
	setupPublicEventRoutes(mux)

	mux.Group(func(mux chi.Router) {
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		setupProjectRoutes(mux)
	})

	// Use Authboss middleware for protected routes
	mux.Route("/{projectid}", func(mux chi.Router) {
		mux.Use(svmw.ProjectMiddleware(projectDbs))
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		mux.Post("/dummy", routes.GenerateDummyEvents)
		setupPrivateEventRoutes(mux)
		setupAnalyticsRoutes(mux)
		routes.SetupPersonsRoutes(mux)
		setupProjectSpecificRoutes(mux)
	})

	return mux
}
func setupProjectRoutes(mux chi.Router) {
	mux.Get("/projects", routes.ListProjects)
	mux.Post("/projects", routes.CreateProject)
}

func setupProjectSpecificRoutes(mux chi.Router) {
	mux.Post("/settings", routes.UpdateProjectSettings)
}

func setupPublicEventRoutes(mux chi.Router) {
	mux.Post("/event", routes.AppendEvent)
}

func setupPrivateEventRoutes(mux chi.Router) {
	mux.Get("/events", routes.QueryEvents)
	mux.Get("/events/parquet", routes.QueryEventAsParquet)
	mux.Post("/event", routes.AppendEvent)
	mux.Get("/events/parquet/kw", routes.QueryEventsKW)
	mux.Get("/events/parquet/months", routes.QueryEventsMonth)
	mux.Get("/events/parquet/export", routes.EventsExport)
	mux.Get("/events/parquet/checksums", routes.LastTwelveWeeksChecksums)
	mux.Get("/events/parquet/months/checksums", routes.LastTwelveMonthsChecksums)
	mux.Get("/events/parquet/seq/checksums", routes.FileChecksums)
	mux.Get("/events/parquet/gen", routes.RegenerateFiles)
}

func setupAnalyticsRoutes(mux chi.Router) {
	routes.SetupSchemaRoutes(mux)
	//mux.Get("/insights/", ListInsights)
	routes.SetupInsightRoutes(mux)
	routes.SetupDashoardRoutes(mux)
}

func setupMiddleware(r *chi.Mux, projectDbs appdb.ProjectDBLookup, appdb *gorm.DB) {
	r.Use(middleware.RequestID)
	r.Use(svmw.Logger(log.Logger, &svmw.LoggerOpts{
		WithReferer:   false,
		WithUserAgent: false,
	}))
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(ab.LoadClientStateMiddleware)
	r.Use(remember.Middleware(ab))
	r.Use(svmw.AuthbossMW(ab))
	r.Use(svmw.DbLookupMiddleware(projectDbs, appdb))
}

//func setupCORS(mux *chi.Mux, c Config) {
//	mux.Use(cors.Handler(cors.Options{
//		AllowedOrigins: []string{
//			c.FrontendUrl,
//			c.Url,
//		},
//		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
//		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "Set-Cookie"},
//		ExposedHeaders:   []string{"Set-Cookie"},
//		AllowCredentials: true,
//		MaxAge:           300, // Maximum value not ignored by any of major browsers
//	}))
//}
