package routes

import (
	"analytics/domain/dashboards"
	"analytics/domain/insights"
	"analytics/internal/log"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"net/http"
	"strconv"
)

func SetupDashoardRoutes(mux chi.Router) {
	mux.Get("/dashboards", listDashboards)
	mux.Post("/dashboards", createDashboard)
	mux.Get("/dashboards/{id}", getDashboard)
	mux.Put("/dashboards/{id}", updateDashboard)
	mux.Delete("/dashboards/{id}", deleteDashboard)
	mux.Put("/dashboards/{id}/insights", setDashboardInsights)
	mux.Put("/dashboards/{id}/home", setHomeDashboard)
}

func parseDashboardId(id string) (int, error) {
	intId, err := strconv.Atoi(id)
	if err != nil {
		return 0, err
	}
	return intId, nil
}

func loadDashboard(db *gorm.DB, id string) (*dashboards.Dashboard, error) {
	var dashboard dashboards.Dashboard
	dashboardId, err := parseDashboardId(id)
	if err != nil {
		return nil, err
	}

	// First get the dashboard
	if err := db.First(&dashboard, dashboardId).Error; err != nil {
		return nil, err
	}

	// Then get insights with order
	var insights []insights.Insight
	err = db.Table("insights").
		Select("insights.*").
		Joins("JOIN dashboard_insights ON dashboard_insights.insight_id = insights.id").
		Where("dashboard_insights.dashboard_id = ?", dashboardId).
		Order("dashboard_insights.sort ASC").
		Find(&insights).Error

	dashboard.Insights = insights
	return &dashboard, err
}

func loadDashboards(db *gorm.DB) ([]dashboards.Dashboard, error) {
	var dashboards []dashboards.Dashboard

	// First get all dashboards
	if err := db.Find(&dashboards).Error; err != nil {
		return nil, err
	}

	// For each dashboard, load its insights
	for i := range dashboards {
		var insights []insights.Insight
		err := db.Table("insights").
			Select("insights.*").
			Joins("JOIN dashboard_insights ON dashboard_insights.insight_id = insights.id").
			Where("dashboard_insights.dashboard_id = ?", dashboards[i].ID).
			Order("dashboard_insights.sort ASC").
			Find(&insights).Error

		if err != nil {
			return nil, err
		}

		dashboards[i].Insights = insights
	}

	return dashboards, nil
}

func listDashboards(w http.ResponseWriter, r *http.Request) {
	db := sv_mw.GetProjectDB(r, w)
	w.Header().Set("Content-Type", "application/json")

	dashboards, err := loadDashboards(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(dashboards); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func createDashboard(w http.ResponseWriter, r *http.Request) {
	var input dashboards.DashboardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dashboard := dashboards.Dashboard{}
	dashboard.ApplyInput(input)

	db := sv_mw.GetProjectDB(r, w)
	result := db.Create(&dashboard)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	fullDashboard, err := loadDashboard(db, fmt.Sprintf("%d", dashboard.ID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(fullDashboard); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func getDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	db := sv_mw.GetProjectDB(r, w)

	dashboard, err := loadDashboard(db, id)
	if err != nil {
		http.Error(w, "Dashboard not loaded: "+err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(dashboard); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func updateDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input dashboards.DashboardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	db := sv_mw.GetProjectDB(r, w)

	dashboard, err := loadDashboard(db, id)
	if err != nil {
		http.Error(w, "Dashboard not loaded: "+err.Error(), http.StatusNotFound)
		return
	}

	dashboard.ApplyInput(input)

	if result := db.Save(dashboard); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(dashboard); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func deleteDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	db := sv_mw.GetProjectDB(r, w)

	if result := db.Delete(&dashboards.Dashboard{}, id); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type InsightIDs struct {
	IDs []uint `json:"insight_ids"`
}

func setDashboardInsights(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input InsightIDs
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	db := sv_mw.GetProjectDB(r, w)

	var dashboard dashboards.Dashboard
	if result := db.First(&dashboard, id); result.Error != nil {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}

	// Begin transaction
	tx := db.Begin()

	// Clear existing associations
	if err := tx.Model(&dashboard).Association("Insights").Clear(); err != nil {
		tx.Rollback()
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create new associations with sort
	for sort, insightID := range input.IDs {
		if err := tx.Exec(`
            INSERT INTO dashboard_insights (dashboard_id, insight_id, sort)
            VALUES (?, ?, ?)
        `, dashboard.ID, insightID, sort).Error; err != nil {
			tx.Rollback()
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	log.Info("Updated dashboard %d with %d insights", dashboard.ID, len(input.IDs))
	dashboardUpdated, err := loadDashboard(tx, fmt.Sprintf("%d", dashboard.ID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboardUpdated)
}

func setHomeDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	db := sv_mw.GetProjectDB(r, w)

	// First, set home=false for all dashboards
	if result := db.Model(&dashboards.Dashboard{}).
		Where("home = true").
		Update("home", false); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Then set home=true for the specified dashboard
	var dashboard dashboards.Dashboard
	if result := db.First(&dashboard, id); result.Error != nil {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}

	dashboard.Home = true
	if result := db.Save(&dashboard); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Return the updated dashboard
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboard)
}
