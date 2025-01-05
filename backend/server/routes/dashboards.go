package routes

import (
	"analytics/model"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
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
}

func loadDashboards(db *gorm.DB) *gorm.DB {
	return db.Preload("Insights.Series")
}

func loadDashboard(db *gorm.DB, id string) (*model.Dashboard, error) {
	intId, err := strconv.Atoi(id)
	if err != nil {
		return nil, err
	}
	var dashboard model.Dashboard
	result := db.Preload("Insights.Series").First(&dashboard, intId)
	return &dashboard, result.Error
}

func listDashboards(w http.ResponseWriter, r *http.Request) {
	var dashboards []model.Dashboard
	db := sv_mw.GetProjectDB(r, w)

	loadDashboards(db).Find(&dashboards)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboards)
}

func createDashboard(w http.ResponseWriter, r *http.Request) {
	var input model.DashboardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dashboard := model.Dashboard{
		Name: input.Name,
	}

	db := sv_mw.GetProjectDB(r, w)

	if result := db.Create(&dashboard); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(dashboard)
}

func getDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	db := sv_mw.GetProjectDB(r, w)

	dashboard, err := loadDashboard(db, id)
	if err != nil {
		http.Error(w, "Dashboard not loaded: "+err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboard)
}

func updateDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.DashboardInput
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

	dashboard.Name = input.Name

	if result := db.Save(dashboard); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboard)
}

func deleteDashboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	db := sv_mw.GetProjectDB(r, w)

	if result := db.Delete(&model.Dashboard{}, id); result.Error != nil {
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

	dashboard, err := loadDashboard(db, id)
	if err != nil {
		http.Error(w, "Dashboard not loaded: "+err.Error(), http.StatusNotFound)
		return
	}

	var insights []model.Insight
	if result := db.Find(&insights, input.IDs); result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	if err := db.Model(dashboard).Association("Insights").Replace(insights); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboard)
}
