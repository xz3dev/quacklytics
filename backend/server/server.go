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
		FrontendUrl: "http://localhost:3001",
	}
}

const port = 3000

func test(w http.ResponseWriter, req *http.Request, handled bool) (bool, error) {
	log.Printf("test")
	return false, nil
}

func Start() {
	config := DefaultConfig()
	var err error
	ab, err = auth.SetupAuthboss(appdb.I)
	ab.Events.After(authboss.EventRegister, test)
	ab.Events.After(authboss.EventAuth, test)
	ab.Events.After(authboss.EventAuthHijack, test)
	ab.Events.After(authboss.EventOAuth2, test)
	ab.Events.After(authboss.EventAuthFail, test)
	ab.Events.After(authboss.EventOAuth2Fail, test)
	ab.Events.After(authboss.EventRecoverStart, test)
	ab.Events.After(authboss.EventRecoverEnd, test)
	ab.Events.After(authboss.EventGetUser, test)
	ab.Events.After(authboss.EventGetUserSession, test)
	ab.Events.After(authboss.EventPasswordReset, test)
	ab.Events.After(authboss.EventLogout, test)
	ab.Events.After(authboss.EventTwoFactorAdded, test)
	ab.Events.After(authboss.EventTwoFactorRemoved, test)
	if err != nil {
		log.Fatal(err)
	}
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
	//mux.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))

	// Mount Authboss
	mux.Mount("/auth", http.StripPrefix("/auth", ab.Config.Core.Router))
	mux.Get("/auth/me", routes.CurrentUser)
	setupPublicEventRoutes(mux)

	// Use Authboss middleware for protected routes
	mux.Group(func(r chi.Router) {
		r.Use(authboss.Middleware2(ab, authboss.RequireNone, authboss.RespondUnauthorized))
		r.Get("/me", routes.CurrentUser)
		setupPrivateEventRoutes(r)
		setupAnalyticsRoutes(r)
	})
	return mux
}

func setupPublicEventRoutes(mux chi.Router) {
	mux.Post("/event", routes.AppendEvent)
}

func setupPrivateEventRoutes(mux chi.Router) {
	mux.Get("/events", routes.QueryEvents)
	mux.Get("/events/parquet", routes.QueryEventAsParquet)
	mux.Post("/event", routes.AppendEvent)
	mux.Post("/dummy", routes.GenerateDummyEvents)
	mux.Get("/events/parquet/kw", routes.QueryEventsKW)
	mux.Get("/events/parquet/checksums", routes.LastTwelveWeeksChecksums)
}

func setupAnalyticsRoutes(mux chi.Router) {
	mux.Get("/dashboards", routes.Dashboards)
	mux.Post("/dashboards", routes.CreateDashboard)
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
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	}))
}
