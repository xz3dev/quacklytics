package sv_mw

import (
	"analytics/database/appdb"
	"context"
	"gorm.io/gorm"
	"net/http"
)

const ProjectDBLookupKey = "project_db_lookup"
const AppDBLookupKey = "app_db"

func DbLookupMiddleware(dbMap *appdb.ProjectDBLookup, appdb *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := withDbLookupContext(r.Context(), dbMap, appdb)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func withDbLookupContext(ctx context.Context, dbMap *appdb.ProjectDBLookup, appdb *gorm.DB) context.Context {
	ctx = context.WithValue(ctx, ProjectDBLookupKey, dbMap)
	ctx = context.WithValue(ctx, AppDBLookupKey, appdb)
	return ctx
}

func GetAppDB(r *http.Request) *gorm.DB {
	db, ok := r.Context().Value(AppDBLookupKey).(*gorm.DB)
	if !ok {
		panic("App DB not found in context")
	}
	return db
}
