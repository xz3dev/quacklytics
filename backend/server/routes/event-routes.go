package routes

import (
	"analytics/actions"
	"analytics/database/analyticsdb"
	"analytics/domain/events"
	"analytics/domain/events/processor"
	"analytics/domain/queries"
	"analytics/internal/log"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"net/http"
)

func SetupPrivateEventRoutes(mux chi.Router) {
	mux.Get("/events", QueryEvents)
	mux.Post("/events/dummy", GenerateDummyEvents)
}

func AppendEvent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	apikey := r.Header.Get("X-API-KEY")
	if apikey == "" {
		http.Error(w, "X-API-KEY header not found", http.StatusUnauthorized)
		return
	}
	appdb := sv_mw.GetAppDB(r)
	projectId, err := actions.ValidateAPIKey(appdb, apikey)
	if err != nil {
		http.Error(w, "Invalid ApiKey", http.StatusUnauthorized)
		return
	}

	var event []events.EventInput
	err = json.NewDecoder(r.Body).Decode(&event)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Fatal(err.Error(), err)
		return
	}

	projectIdFromUrl := sv_mw.GetProjectID(r)

	if projectId != projectIdFromUrl {
		http.Error(w, fmt.Sprintf("wrong api key for project: %s", projectIdFromUrl), http.StatusBadRequest)
	}
	for _, e := range event {
		processor.ProcessEvent(projectId, &e)
	}

	w.WriteHeader(http.StatusOK)
}

func QueryEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	queryParams, err := queries.ExtractQueryParams(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid query parameters: "+err.Error())
		return
	}

	projectId := sv_mw.GetProjectID(r)

	analyticsDb := analyticsdb.LookupTable[projectId]
	if analyticsDb == nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	events, err := events.QueryEvents(analyticsDb, queryParams)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		log.Error("Error while querying events: %v", err)
		json.NewEncoder(w).Encode(map[string]string{"error": "Internal server error"})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(events)
}

func GenerateDummyEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	projectId := sv_mw.GetProjectID(r)

	actions.GenerateRandomEvents(projectId, 100, "test_type")
	//actions.GenerateRandomEvents(100, "test_type2")
	//actions.GenerateRandomEvents(100, "test_type3")
	//actions.GenerateRandomEvents(100, "test_type4")
	w.WriteHeader(http.StatusOK)
}

func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
