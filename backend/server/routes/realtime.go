package routes

import (
	"analytics/auth"
	"analytics/internal/log"
	"analytics/server/middlewares"
	"encoding/json"
	"github.com/google/uuid"
	"net/http"
	"time"
)

func RequestRealtimeToken(w http.ResponseWriter, r *http.Request) {
	appDb := sv_mw.GetAppDB(r)

	ab := sv_mw.GetAuthboss(r)

	user, err := ab.LoadCurrentUser(&r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
	}

	uid := auth.UUID{UUID: uuid.MustParse(user.GetPID())}
	token, err := auth.CreateRealtimeToken(appDb, uid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	response := struct {
		Token      string    `json:"token"`
		ValidUntil time.Time `json:"validUntil"`
	}{
		Token:      token.Token,
		ValidUntil: token.DeletedAt.Time,
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func RealtimeWebSocketEndpoint(w http.ResponseWriter, r *http.Request) {
	conn := sv_mw.GetWebsocketConn(r)
	defer conn.Close()

	log.Info("WebSocket connection established")

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Error(err.Error())
			return
		}
		if err := conn.WriteMessage(messageType, p); err != nil {
			log.Error(err.Error())
			return
		}
	}
}
