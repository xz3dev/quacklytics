package server

import (
	"analytics/actions"
	"analytics/auth"
	"analytics/config"
	"analytics/database/appdb"
	"analytics/log"
	svmw "analytics/server/middlewares"
	"analytics/server/posthog"
	"analytics/server/routes"
	"embed"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/remember"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"io/fs"
	"net/http"
	"os"
	"strings"
)

//go:embed public
var publicFiles embed.FS

var ab *authboss.Authboss

func Start(appDb *gorm.DB, projectDbs *appdb.ProjectDBLookup) {
	var err error
	ab, err = auth.SetupAuthboss(appDb)
	if err != nil {
		log.Fatal(err.Error(), err)
	}
	server := http.Server{
		Addr:     fmt.Sprintf(":%d", config.Config.Port),
		Handler:  setupMux(projectDbs, appDb),
		ErrorLog: zap.NewStdLog(log.Logger),
	}

	ab.Events.After(authboss.EventRegister, func(w http.ResponseWriter, r *http.Request, handled bool) (bool, error) {
		actions.CreateDefaultProject()
		return false, nil
	})

	log.Info("Starting server on port %d", config.Config.Port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err.Error(), err)
	}
}

func setupMux(dbs *appdb.ProjectDBLookup, appdb *gorm.DB) *chi.Mux {
	mux := chi.NewMux()
	setupGlobalMiddleware(mux, dbs, appdb)
	if config.Config.ServeFrontend {
		serveFrontend(mux)
	}
	mux.Mount("/api", http.StripPrefix("/api", buildRouter(dbs)))
	return mux
}

func serveFrontend(mux *chi.Mux) {
	frontendDir, err := fs.Sub(publicFiles, "public/frontend")
	if err != nil {
		panic(err)
		log.Fatal(err.Error(), err)
	}

	files := []string{}
	err = fs.WalkDir(frontendDir, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		files = append(files, path)
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		log.Fatal(err.Error(), err)
	}
	log.Info("Serving frontend files: %v", files)
	fileServer := http.FileServerFS(frontendDir)
	mux.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		_, err := frontendDir.Open(path)
		if os.IsNotExist(err) {
			http.ServeFileFS(w, r, frontendDir, "/index.html")
			return
		}
		// Serve the file.
		fileServer.ServeHTTP(w, r)
	})
}

func buildRouter(projectDbs *appdb.ProjectDBLookup) *chi.Mux {
	mux := chi.NewMux()

	mux.Mount("/auth", http.StripPrefix("/auth", ab.Config.Core.Router))
	mux.Get("/auth/me", routes.CurrentUser)

	mux.Group(func(mux chi.Router) {
		mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		setupProjectRoutes(mux)
		mux.Post("/auth/realtime", routes.RequestRealtimeToken)
	})

	mux.Route("/{projectid}", func(mux chi.Router) {
		mux.Group(func(mux chi.Router) {
			// Authorized Routes
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
		mux.Group(func(mux chi.Router) {
			mux.Use(svmw.NewWebSocketMiddleware().Middleware)
			mux.Get("/realtime", routes.RealtimeWebSocketEndpoint)
			mux.Post("/event", routes.AppendEvent)
		})
	})
	posthog.SetupPosthogRoutes(mux)

	return mux
}

func setupProjectRoutes(mux chi.Router) {
	mux.Get("/projects", routes.ListProjects)
	mux.Post("/projects", routes.CreateProject)
}

func setupGlobalMiddleware(r *chi.Mux, projectDbs *appdb.ProjectDBLookup, appdb *gorm.DB) {
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
