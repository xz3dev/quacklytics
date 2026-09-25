package routes

import (
	"analytics/database/analyticsdb"
	"analytics/database/appdb"
	"analytics/domain/apikeys"
	"analytics/domain/events"
	"analytics/domain/events/processor"
	"analytics/domain/projects"
	"analytics/domain/queries"
	"analytics/log"
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
	projectId, err := apikeys.ValidateAPIKey(appdb, apikey)
	if err != nil {
		http.Error(w, "Invalid ApiKey", http.StatusUnauthorized)
		return
	}
	if !allowIngestionOrigin(w, r, projectId) {
		http.Error(w, "Origin is not allowed for this project", http.StatusForbidden)
		return
	}

	event, err := decodeEventPayload(r)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	projectIdFromUrl := chi.URLParam(r, "projectid")
	if projectIdFromUrl != "" && projectId != projectIdFromUrl {
		http.Error(w, fmt.Sprintf("wrong api key for project: %s", projectIdFromUrl), http.StatusBadRequest)
		return
	}

	processor.ProcessEvents(projectId, event)

	w.WriteHeader(http.StatusOK)
}

func allowIngestionOrigin(w http.ResponseWriter, r *http.Request, projectId string) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	dbLookup, ok := r.Context().Value(sv_mw.ProjectDBLookupKey).(*appdb.ProjectDBLookup)
	if !ok {
		return false
	}
	projectDb, ok := (*dbLookup)[projectId]
	if !ok {
		return false
	}
	settings, err := projects.QuerySettings(projectId, projectDb)
	if err != nil || !projects.IsCorsOriginAllowed(settings, origin) {
		return false
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Add("Vary", "Origin")
	return true
}

func decodeEventPayload(r *http.Request) ([]*events.EventInput, error) {
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		return nil, err
	}

	var batch []*events.EventInput
	if err := json.Unmarshal(raw, &batch); err == nil {
		return batch, nil
	}

	var single events.EventInput
	if err := json.Unmarshal(raw, &single); err != nil {
		return nil, err
	}
	return []*events.EventInput{&single}, nil
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

	processor.GenerateRandomEvents(projectId, 100, "test_type")
	//actions.GenerateRandomEvents(100, "test_type2")
	//actions.GenerateRandomEvents(100, "test_type3")
	//actions.GenerateRandomEvents(100, "test_type4")
	w.WriteHeader(http.StatusOK)
}

func respondError(w http.ResponseWriter, statusCode int, message string) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
