package routes

import (
	"analytics/model"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"net/http"
)

func Dashboards(w http.ResponseWriter, r *http.Request) {
	var dashboards []model.Dashboard

	db := sv_mw.GetProjectDB(r, w)

	db.Find(&dashboards)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboards)
}

func CreateDashboard(w http.ResponseWriter, r *http.Request) {

}
