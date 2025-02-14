package routes

import (
	"analytics/actions"
	"analytics/database/appdb"
	"analytics/log"
	"analytics/model"
	"analytics/projects"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"net/http"
	"strconv"
)

type projectData struct {
	Id        string             `json:"id"`
	Name      string             `json:"name"`
	Partition string             `json:"partition"`
	AutoLoad  int                `json:"autoload"`
	Files     model.ProjectFiles `json:"files"`
}

func ListProjects(writer http.ResponseWriter, request *http.Request) {
	dbLookup := request.Context().Value(sv_mw.ProjectDBLookupKey).(appdb.ProjectDBLookup)

	projectList := projects.ListProjects()
	data := make([]projectData, 0, len(projectList))
	for _, project := range projectList {
		projDb, ok := dbLookup[project.ID]
		if !ok {
			http.Error(writer, fmt.Sprintf("Project DB not found: %s", project.ID), http.StatusInternalServerError)
			return
		}
		settings, err := projects.QuerySettings(projDb)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}

		autoload, err := strconv.Atoi(settings[projects.AutoLoadRange])
		if err != nil {
			log.Warn("Invalid autoload range: %s should be parsable as an integer", settings[projects.AutoLoadRange])
		}
		if autoload <= 0 {
			autoload = 6
		}

		data = append(data, projectData{
			Id:        project.ID,
			Name:      settings[projects.Name],
			Partition: settings[projects.Partition],
			AutoLoad:  autoload,
			Files:     project,
		})
	}
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	json.NewEncoder(writer).Encode(data)
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

func SetupProjectSpecificRoutes(mux chi.Router) {
	mux.Post("/settings", UpdateProjectSettings)
}

func UpdateProjectSettings(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	var input []ProjectSettingsUpdate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, update := range input {
		projects.UpdateSetting(db, update.Key, update.Value)
	}
	ListProjects(w, r)
}

type ProjectSettingsUpdate struct {
	Key   model.ProjectSettingKey `json:"key"`
	Value string                  `json:"value"`
}
