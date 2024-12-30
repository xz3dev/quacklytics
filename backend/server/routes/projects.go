package routes

import (
	"analytics/actions"
	"analytics/projects"
	"encoding/json"
	"net/http"
)

func ListProjects(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)

	json.NewEncoder(writer).Encode(projects.ListProjects())
}

func CreateProject(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)

	var input struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	project := actions.CreateProject(input.Name)

	json.NewEncoder(writer).Encode(project)
}
