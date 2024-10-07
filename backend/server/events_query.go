package server

import (
	"analytics/actions"
	"analytics/queries"
	"encoding/json"
	"log"
	"net/http"
)

func queryEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	queryParams, err := queries.ExtractQueryParams(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid query parameters: "+err.Error())
		return
	}

	events, err := actions.QueryEvents(queryParams)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(events)
}

///events?minDate=2023-01-01T00:00:00Z&maxDate=2023-12-31T23:59:59Z&eventType=click&prop_button=submit&prop_button=cancel&property_page=home

func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
