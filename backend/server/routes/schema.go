package routes

import (
	"analytics/actions"
	"analytics/log"
	"analytics/schema"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
)

type PropertyDetails struct {
	Type string `json:"type"`
	Id   int    `json:"id"`
}

func SetupSchemaRoutes(mux chi.Router) {
	mux.Get("/schema", getSchema)
	mux.Get("/schema/prop/{id}", getProperty)
	mux.Patch("/schema", fixupSchema)
}

func getProperty(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Property ID not found in path", http.StatusBadRequest)
		return
	}

	var propValues []string
	var result []schema.EventSchemaPropertyValue
	db.Where("event_schema_property_id = ?", id).Find(&result)
	for _, val := range result {
		propValues = append(propValues, val.Value)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(propValues)
}

func fixupSchema(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	projectId := chi.URLParam(r, "projectid")
	if projectId == "" {
		http.Error(w, "Project ID not found in path", http.StatusBadRequest)
		return
	}

	if err := actions.FixupSchema(projectId, db); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func getSchema(w http.ResponseWriter, r *http.Request) {

	db := sv_mw.GetProjectDB(r, w)
	var ss []schema.EventSchema
	query := db.Preload("Properties").Find(&ss)
	if query.Error != nil {
		log.Error("Error while querying schema: %v", query.Error)
		http.Error(w, query.Error.Error(), http.StatusInternalServerError)
		return
	}

	result := make(map[string]map[string]PropertyDetails)

	for _, s := range ss {
		properties := make(map[string]PropertyDetails)
		for _, prop := range s.Properties {
			properties[prop.Key] = PropertyDetails{
				Type: prop.Type,
				Id:   prop.ID,
			}
		}
		result[s.EventType] = properties
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(result)
}
