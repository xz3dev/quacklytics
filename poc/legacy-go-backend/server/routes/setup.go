package routes

import (
	"analytics/auth"
	svmw "analytics/server/middlewares"
	"encoding/json"
	"net/http"
)

type resp struct {
	AdminRegistered bool `json:"adminRegistered"`
}

func SetupStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	appdb := svmw.GetAppDB(r)
	var existingUsers []auth.User
	appdb.Find(&existingUsers)
	adminRegistered := len(existingUsers) > 0

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(resp{AdminRegistered: adminRegistered})
}
