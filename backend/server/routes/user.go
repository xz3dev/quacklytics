package routes

import (
	"analytics/auth"
	sv_mw "analytics/server/middlewares"
	"analytics/util"
	"encoding/json"
	"log"
	"net/http"
)

func CurrentUser(w http.ResponseWriter, r *http.Request) {
	cookies := r.Cookies()
	for _, cookie := range cookies {
		log.Printf("Cookie: %s=%s", cookie.Name, cookie.Value)
	}
	ab, err := sv_mw.GetAuthboss(r)
	util.HandleError(w, err)
	user, err := ab.CurrentUser(r)
	util.HandleError(w, err)

	// Cast the user to your custom User type
	if user == nil {
		util.WriteError(w, http.StatusUnauthorized, "No user logged in")
		return
	}

	currentUser, ok := user.(*auth.User)
	if !ok {
		util.WriteError(w, http.StatusInternalServerError, "Failed to cast user to User")
		return
	}

	// Convert user to JSON and send response
	json.NewEncoder(w).Encode(currentUser)
}
