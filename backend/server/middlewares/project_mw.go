package sv_mw

import (
	"analytics/database/appdb"
	"context"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"log"
	"net/http"
)

const ProjectDBKey = "project_db"
const ProjectIDKey = "project_id"

func ProjectMiddleware(dbMap appdb.ProjectDBLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract projectID from URL parameters
			projectID := chi.URLParam(r, "projectid")
			if projectID == "" {
				http.Error(w, "Project ID not found in path", http.StatusBadRequest)
				return
			}

			// Get DB instance for this project
			db, exists := dbMap[projectID]
			if !exists {
				http.Error(w, "Project database not found", http.StatusNotFound)
				return
			}

			// Add DB to context
			ctx := withProjectContext(r.Context(), db, projectID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetProjectDB(r *http.Request, w http.ResponseWriter) *gorm.DB {
	db, ok := r.Context().Value(ProjectDBKey).(*gorm.DB)
	if !ok {
		http.Error(w, "Project DB not found in context", http.StatusNotFound)
	}
	return db
}

func GetProjectID(r *http.Request) string {
	id := r.Context().Value(ProjectIDKey)
	log.Printf("Getting project ID from context: %v", id)
	return id.(string)
}

func withProjectContext(ctx context.Context, db *gorm.DB, projectID string) context.Context {
	ctx = context.WithValue(ctx, ProjectDBKey, db)
	ctx = context.WithValue(ctx, ProjectIDKey, projectID)
	return ctx
}
