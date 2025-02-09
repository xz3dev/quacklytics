package server

import (
	"analytics/auth"
	"analytics/config"
	"analytics/database/appdb"
	"analytics/log"
	svmw "analytics/server/middlewares"
	"analytics/server/routes"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/remember"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var ab *authboss.Authboss

func Start(appDb *gorm.DB, projectDbs appdb.ProjectDBLookup) {
	config := config.Load()
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

	log.Info("Starting server on port %d", config.Port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err.Error(), err)
	}
}

func setupMux(dbs appdb.ProjectDBLookup, appdb *gorm.DB) *chi.Mux {
	mux := chi.NewMux()
	setupGlobalMiddleware(mux, dbs, appdb)

	mux.Mount("/api", http.StripPrefix("/api", buildRouter(dbs)))
	return mux
}

func buildRouter(projectDbs appdb.ProjectDBLookup) *chi.Mux {
	mux := chi.NewMux()

	mux.Mount("/auth", http.StripPrefix("/auth", ab.Config.Core.Router))
	mux.Get("/auth/me", routes.CurrentUser)
	mux.Post("/event", routes.AppendEvent)

	mux.Group(func(mux chi.Router) {
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		setupProjectRoutes(mux)
	})

	mux.Route("/{projectid}", func(mux chi.Router) {
		mux.Use(svmw.ProjectMiddleware(projectDbs))
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		mux.Post("/dummy", routes.GenerateDummyEvents)
		routes.SetupPrivateEventRoutes(mux)
		routes.SetupFileCatalogRoutes(mux)
		routes.SetupSchemaRoutes(mux)
		routes.SetupInsightRoutes(mux)
		routes.SetupDashoardRoutes(mux)
		routes.SetupPersonsRoutes(mux)
		routes.SetupProjectSpecificRoutes(mux)
	})

	return mux
}

func setupProjectRoutes(mux chi.Router) {
	mux.Get("/projects", routes.ListProjects)
	mux.Post("/projects", routes.CreateProject)
}

func setupGlobalMiddleware(r *chi.Mux, projectDbs appdb.ProjectDBLookup, appdb *gorm.DB) {
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
