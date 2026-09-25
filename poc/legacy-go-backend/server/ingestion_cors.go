package server

import (
	"analytics/database/appdb"
	"analytics/domain/projects"
	"net/http"
	"strings"
)

func ingestionCorsMiddleware(projectDbs *appdb.ProjectDBLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !isIngestionPath(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			if isOriginAllowedForIngestion(projectDbs, r.URL.Path, origin) {
				setIngestionCorsHeaders(w, origin)
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			} else if r.Method == http.MethodOptions {
				http.Error(w, "Origin is not allowed for ingestion", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func setIngestionCorsHeaders(w http.ResponseWriter, origin string) {
	header := w.Header()
	header.Set("Access-Control-Allow-Origin", origin)
	header.Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	header.Set("Access-Control-Allow-Headers", "Content-Type, X-API-KEY")
	header.Set("Access-Control-Max-Age", "600")
	header.Add("Vary", "Origin")
	header.Add("Vary", "Access-Control-Request-Method")
	header.Add("Vary", "Access-Control-Request-Headers")
}

func isOriginAllowedForIngestion(projectDbs *appdb.ProjectDBLookup, path string, origin string) bool {
	projectId, hasProjectId := projectIdFromIngestionPath(path)
	if hasProjectId {
		return isOriginAllowedForProject(projectDbs, projectId, origin)
	}

	for projectId := range *projectDbs {
		if isOriginAllowedForProject(projectDbs, projectId, origin) {
			return true
		}
	}
	return false
}

func isOriginAllowedForProject(projectDbs *appdb.ProjectDBLookup, projectId string, origin string) bool {
	projectDb, exists := (*projectDbs)[projectId]
	if !exists {
		return false
	}
	settings, err := projects.QuerySettings(projectId, projectDb)
	if err != nil {
		return false
	}
	return projects.IsCorsOriginAllowed(settings, origin)
}

func isIngestionPath(path string) bool {
	if path == "/event" {
		return true
	}
	_, hasProjectId := projectIdFromIngestionPath(path)
	return hasProjectId
}

func projectIdFromIngestionPath(path string) (string, bool) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 || parts[1] != "event" || parts[0] == "" {
		return "", false
	}
	return parts[0], true
}
