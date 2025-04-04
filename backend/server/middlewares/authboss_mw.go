package sv_mw

import (
	"context"
	"github.com/volatiletech/authboss/v3"
	"net/http"
)

type contextKey string

const AuthbossKey contextKey = "authboss"

func AuthbossMW(ab *authboss.Authboss) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), AuthbossKey, ab)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetAuthboss(r *http.Request) *authboss.Authboss {
	ab, ok := r.Context().Value(AuthbossKey).(*authboss.Authboss)
	if !ok {
		panic("Authboss not found in context")
	}
	return ab
}
