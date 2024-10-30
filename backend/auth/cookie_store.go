package auth

import (
	"github.com/gorilla/sessions"
	"github.com/volatiletech/authboss/v3"
	"net/http"
)

var sessionStore *sessions.CookieStore

func initAuthStores() {
	sessionStoreKey := []byte("very-secret")

	sessionStore = sessions.NewCookieStore(sessionStoreKey)
	sessionStore.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 30, // 30 days
		HttpOnly: true,
		Secure:   false, // Set to true if using HTTPS
		SameSite: http.SameSiteNoneMode,
	}
}

type SessionStore struct {
	key string
}

func NewCookieStore(key string) authboss.ClientStateReadWriter {
	return &SessionStore{key}
}

func (s SessionStore) ReadState(r *http.Request) (authboss.ClientState, error) {
	return s.LoadClientState(r)
}

func (s SessionStore) WriteState(w http.ResponseWriter, state authboss.ClientState, ev []authboss.ClientStateEvent) error {
	session := state.(*SessionState)

	// Apply all the events
	for _, e := range ev {
		switch e.Kind {
		case authboss.ClientStateEventPut:
			session.Set(e.Key, e.Value)
		case authboss.ClientStateEventDel:
			session.Delete(e.Key)
		}
	}

	return session.session.Save(session.request, w)
}

type SessionState struct {
	session *sessions.Session
	request *http.Request
}

func (s SessionState) Get(key string) (string, bool) {
	val, ok := s.session.Values[key]
	if !ok {
		return "", false
	}
	str, ok := val.(string)
	if !ok {
		return "", false
	}
	return str, true
}

func (s SessionState) Set(key, value string) {
	s.session.Values[key] = value
}

func (s SessionState) Delete(key string) {
	delete(s.session.Values, key)
}

func (s SessionStore) LoadClientState(r *http.Request) (authboss.ClientState, error) {
	session, err := sessionStore.Get(r, s.key)
	if err != nil {
		return nil, err
	}
	return &SessionState{session, r}, nil
}
