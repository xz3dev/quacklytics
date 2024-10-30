package routes

import (
	"analytics/database/appdb"
	"analytics/model"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

func SetupInsightRoutes(mux chi.Router) {
	mux.Get("/insights", listInsights)
	mux.Post("/insights", createInsight)
	mux.Get("/insights/{id}", getInsight)
	mux.Put("/insights/{id}", updateInsight)
	mux.Delete("/insights/{id}", deleteInsight)
}

func listInsights(w http.ResponseWriter, r *http.Request) {
	var insights []model.Insight
	result := appdb.I.Preload("Series").Find(&insights)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insights)
}

func createInsight(w http.ResponseWriter, r *http.Request) {
	var input model.InsightInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	insight := model.Insight{
		InsightInput: input,
	}

	result := appdb.I.Create(&insight)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Reload the insight to get the series
	appdb.I.Preload("Series").First(&insight, insight.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(insight)
}

func getInsight(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid insight ID", http.StatusBadRequest)
		return
	}

	var insight model.Insight
	result := appdb.I.Preload("Series").First(&insight, id)
	if result.Error != nil {
		http.Error(w, "Insight not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insight)
}

func updateInsight(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid insight ID", http.StatusBadRequest)
		return
	}

	var input model.InsightInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var insight model.Insight
	result := appdb.I.Preload("Series").First(&insight, id)
	if result.Error != nil {
		http.Error(w, "Insight not found", http.StatusNotFound)
		return
	}

	insight.ApplyInput(input)

	result = appdb.I.Save(&insight)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Reload the insight to get updated series
	appdb.I.Preload("Series").First(&insight, insight.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insight)
}

func deleteInsight(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid insight ID", http.StatusBadRequest)
		return
	}

	result := appdb.I.Delete(&model.Insight{}, id)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
