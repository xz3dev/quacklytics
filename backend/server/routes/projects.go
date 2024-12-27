package routes

import (
	"analytics/projects"
	"encoding/json"
	"net/http"
)

func ListProjects(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)

	json.NewEncoder(writer).Encode(projects.ListProjects())
}
