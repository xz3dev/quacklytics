package routes

import (
	"analytics/actions"
	"analytics/events"
	"analytics/log"
	"analytics/model"
	"analytics/queries"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"net/http"
)

func SetupPrivateEventRoutes(mux chi.Router) {
	mux.Get("/events", QueryEvents)
	mux.Post("/events/dummy", GenerateDummyEvents)
}

func AppendEvent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var event model.EventInput
	err := json.NewDecoder(r.Body).Decode(&event)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		log.Fatal(err.Error(), err)
		return
	}

	projectId := sv_mw.GetProjectID(r)
	events.ProcessEvent(projectId, &event)

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

	events, err := actions.QueryEvents(projectId, queryParams)
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
