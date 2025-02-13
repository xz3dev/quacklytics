package sv_mw

import (
	"analytics/auth"
	"context"
	"github.com/gorilla/websocket"
	"github.com/volatiletech/authboss/v3"
	"net/http"
)

type AuthMessage struct {
	Token string `json:"token"`
}

type authErrorResponse struct {
	Error string `json:"error"`
}

type WebSocketMiddleware struct {
	upgrader websocket.Upgrader
}

func NewWebSocketMiddleware() *WebSocketMiddleware {
	return &WebSocketMiddleware{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Update this as per your origin security requirement
			},
		},
	}
}

func (ws *WebSocketMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := ws.upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Failed to upgrade to WebSocket", http.StatusInternalServerError)
			return
		}

		// Read and authenticate the initial WebSocket message
		var msg AuthMessage
		err = conn.ReadJSON(&msg)
		if err != nil {
			conn.WriteJSON(authErrorResponse{Error: "Invalid Auth Message"})
			return
		}

		appDb := GetAppDB(r)

		user, err := auth.ConsumeRealtimeToken(appDb, msg.Token)
		if err != nil {
			conn.WriteJSON(authErrorResponse{Error: "Token Invalid"})
			return
		}

		// Store the authenticated user in the context for use by the next handler
		ctx := context.WithValue(r.Context(), authboss.CTXKeyPID, user.GetPID())
		ctx = context.WithValue(ctx, authboss.CTXKeyUser, user)

		// Pass the WebSocket connection to the next handler through the request context
		ctx = context.WithValue(ctx, "websocketConn", conn)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetWebsocketConn(r *http.Request) *websocket.Conn {
	conn, ok := r.Context().Value("websocketConn").(*websocket.Conn)
	if !ok {
		panic("Websocket connection not found in context")
	}
	return conn
}
