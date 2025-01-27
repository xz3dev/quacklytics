package sv_mw

import (
	"analytics/database/appdb"
	"context"
	"net/http"
)

const ProjectDBLookupKey = "project_db_lookup"

func DbLookupMiddleware(dbMap appdb.ProjectDBLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := withDbLookupContext(r.Context(), dbMap)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func withDbLookupContext(ctx context.Context, dbMap appdb.ProjectDBLookup) context.Context {
	ctx = context.WithValue(ctx, ProjectDBLookupKey, dbMap)
	return ctx
}
