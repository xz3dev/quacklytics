package routes

import (
	"analytics/auth"
	sv_mw "analytics/server/middlewares"
	"analytics/util"
	"encoding/json"
	"net/http"
)

func CurrentUser(w http.ResponseWriter, r *http.Request) {
	ab := sv_mw.GetAuthboss(r)
	user, err := ab.CurrentUser(r)
	if err != nil || user == nil {
		util.WriteError(w, http.StatusUnauthorized, "Failed to get current user")
		return
	}

	currentUser, ok := user.(*auth.User)
	if !ok {
		util.WriteError(w, http.StatusUnauthorized, "Failed to cast user to User")
		return
	}

	// Convert user to JSON and send response
	json.NewEncoder(w).Encode(currentUser)
}
