package routes

import (
	"analytics/model"
	sv_mw "analytics/server/middlewares"
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

func getInsight(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid insight ID", http.StatusBadRequest)
		return
	}

	db := sv_mw.GetProjectDB(r, w)

	var insight model.Insight
	result := db.Preload("Series").First(&insight, id)
	if result.Error != nil {
		http.Error(w, "Insight not found: "+result.Error.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insight)
}

func listInsights(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	var insights []model.Insight
	result := db.Preload("Series").Find(&insights)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insights)
}

func createInsight(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	var input model.InsightInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	insight := model.Insight{
		InsightInput: input,
	}

	// Start a transaction
	tx := db.Begin()
	if tx.Error != nil {
		http.Error(w, tx.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Create the insight
	if err := tx.Create(&insight).Error; err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Reload the insight to get the series
	db.Preload("Series").First(&insight, insight.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
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

	db := sv_mw.GetProjectDB(r, w)

	var insight model.Insight
	result := db.Preload("Series").First(&insight, id)
	if result.Error != nil {
		http.Error(w, "Insight not found", http.StatusNotFound)
		return
	}

	// Start a transaction
	tx := db.Begin()
	if tx.Error != nil {
		http.Error(w, tx.Error.Error(), http.StatusInternalServerError)
		return
	}

	insight.ApplyInput(input)

	// Update the insight
	if err := tx.Save(&insight).Error; err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Update series
	if err := insight.UpdateSeries(tx); err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Reload the insight to get updated series
	db.Preload("Series").First(&insight, insight.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(insight)
}

func deleteInsight(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid insight ID", http.StatusBadRequest)
		return
	}

	db := sv_mw.GetProjectDB(r, w)

	// Start a transaction
	tx := db.Begin()
	if tx.Error != nil {
		http.Error(w, tx.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Delete associated series first
	if err := tx.Where("insight_id = ?", id).Delete(&model.Series{}).Error; err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Delete the insight
	if err := tx.Delete(&model.Insight{}, id).Error; err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
