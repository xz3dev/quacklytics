package routes

import (
	"analytics/database/appdb"
	"analytics/model"
	"encoding/json"
	"net/http"
)

func Dashboards(w http.ResponseWriter, r *http.Request) {
	var dashboards []model.Dashboard
	appdb.I.Find(&dashboards)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboards)
}

func CreateDashboard(w http.ResponseWriter, r *http.Request) {

}
