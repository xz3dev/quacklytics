package routes

import (
	"analytics/database/appdb"
	projects2 "analytics/domain/projects"
	"analytics/internal/log"
	"analytics/model"
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
	dbLookup := request.Context().Value(sv_mw.ProjectDBLookupKey).(*appdb.ProjectDBLookup)

	projectList := projects2.ListProjects()
	data := make([]projectData, 0, len(projectList))
	for _, project := range projectList {
		projDb, ok := (*dbLookup)[project.ID]
		if !ok {
			http.Error(writer, fmt.Sprintf("Project DB not found: %s", project.ID), http.StatusInternalServerError)
			return
		}
		settings, err := projects2.QuerySettings(project.ID, projDb)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusInternalServerError)
			return
		}

		autoload, err := strconv.Atoi(settings[projects2.AutoLoadRange])
		if err != nil {
			log.Warn("Invalid autoload range: %s should be parsable as an integer", settings[projects2.AutoLoadRange])
		}
		if autoload <= 0 {
			autoload = 6
		}

		data = append(data, projectData{
			Id:        project.ID,
			Name:      settings[projects2.Name],
			Partition: settings[projects2.Partition],
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

	project, err := projects2.CreateProject(input.Name)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
	}

	projDb, exists := appdb.ProjectDBs[project.ID]
	if !exists {
		http.Error(writer, fmt.Sprintf("Project DB not found: %s", project.ID), http.StatusInternalServerError)
		return
	}

	settings, err := projects2.QuerySettings(project.ID, projDb)
	autoload, err := strconv.Atoi(settings[projects2.AutoLoadRange])
	if err != nil {
		log.Warn("Invalid autoload range: %s should be parsable as an integer", settings[projects2.AutoLoadRange])
	}
	projectData := projectData{
		Id:        project.ID,
		Name:      project.ID,
		Partition: settings[projects2.Partition],
		AutoLoad:  autoload,
		Files:     model.ProjectFiles{},
	}

	json.NewEncoder(writer).Encode(projectData)
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
		projects2.UpdateSetting(db, update.Key, update.Value)
	}
	ListProjects(w, r)
}

type ProjectSettingsUpdate struct {
	Key   model.ProjectSettingKey `json:"key"`
	Value string                  `json:"value"`
}
