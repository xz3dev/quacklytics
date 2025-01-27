package routes

import (
	"analytics/actions"
	"analytics/database/appdb"
	"analytics/projects"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"net/http"
)

type projectData struct {
	Id        string                `json:"id"`
	Name      string                `json:"name"`
	Partition string                `json:"partition"`
	Files     projects.ProjectFiles `json:"files"`
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

		data = append(data, projectData{
			Id:        project.ID,
			Name:      settings[projects.Name],
			Partition: settings[projects.Partition],
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
}

type ProjectSettingsUpdate struct {
	Key   projects.ProjectSettingKey `json:"key"`
	Value string                     `json:"value"`
}
