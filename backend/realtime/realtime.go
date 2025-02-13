package realtime

import (
	"analytics/auth"
	sv_mw "analytics/server/middlewares"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// TODO: add origin check
		return true // Allow all connections. You can adjust this as per your requirements.
	},
}

// WebSocketHandler handles WebSocket connections
func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("Error upgrading connection: %v\n", err)
		http.Error(w, "Could not open websocket connection", http.StatusBadRequest)
		return
	}
	defer conn.Close()

	// Handle incoming WebSocket messages
	for {
		messageType, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("Error reading message: %v\n", err)
			break
		}

		fmt.Printf("Received: %s\n", message)

		// Echo the message back to the client
		err = conn.WriteMessage(messageType, message)
		if err != nil {
			fmt.Printf("Error writing message: %v\n", err)
			break
		}
	}
}

func RequestRealtimeToken(w http.ResponseWriter, r *http.Request) {
	appDb := sv_mw.GetAppDB(r)

	ab, err := sv_mw.GetAuthboss(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}

	user, err := ab.LoadCurrentUser(&r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
	}

	uid := auth.UUID{UUID: uuid.MustParse(user.GetPID())}
	token := auth.CreateRealtimeToken(appDb, uid)

	w.WriteHeader(http.StatusOK)

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

	json.NewEncoder(w).Encode(response)
}
