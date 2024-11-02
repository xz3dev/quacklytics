package routes

import (
	"analytics/database/appdb"
	"analytics/schema"
	"encoding/json"
	"log"
	"net/http"
)

func Schema(w http.ResponseWriter, r *http.Request) {
	var ss []schema.EventSchema
	query := appdb.I.Preload("Properties").Find(&ss)
	if query.Error != nil {
		log.Printf("Error while querying schema: %v", query.Error)
		http.Error(w, query.Error.Error(), http.StatusInternalServerError)
		return
	}

	result := make(map[string]map[string]string)

	for _, s := range ss {
		properties := make(map[string]string)
		for _, prop := range s.Properties {
			properties[prop.Key] = prop.Type
		}
		result[s.EventType] = properties
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(result)
}
