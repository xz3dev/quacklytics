package routes

import (
	"analytics/database/appdb"
	"analytics/schema"
	"encoding/json"
	"log"
	"net/http"
)

type PropertyDetails struct {
	Type   string   `json:"type"`
	Values []string `json:"values"`
}

func Schema(w http.ResponseWriter, r *http.Request) {
	var ss []schema.EventSchema
	query := appdb.I.Debug().Preload("Properties.Values").Find(&ss)
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
