package routes

import (
	"analytics/actions"
	"analytics/schema"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"log"
	"net/http"
)

type PropertyDetails struct {
	Type   string   `json:"type"`
	Values []string `json:"values"`
}

func SetupSchemaRoutes(mux chi.Router) {
	mux.Get("/schema", getSchema)
	mux.Patch("/schema", fixupSchema)
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
	query := db.Preload("Properties.Values").Find(&ss)
	if query.Error != nil {
		log.Printf("Error while querying schema: %v", query.Error)
		http.Error(w, query.Error.Error(), http.StatusInternalServerError)
		return
	}

	result := make(map[string]map[string]PropertyDetails)

	for _, s := range ss {
		properties := make(map[string]PropertyDetails)
		for _, prop := range s.Properties {
			values := make([]string, 0, len(prop.Values))
			for _, val := range prop.Values {
				values = append(values, val.Value)
			}
			properties[prop.Key] = PropertyDetails{
				Type:   prop.Type,
				Values: values,
			}
		}
		result[s.EventType] = properties
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(result)
}
