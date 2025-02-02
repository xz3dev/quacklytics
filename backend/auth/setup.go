package auth

import (
	"analytics/log"
	"encoding/json"
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/defaults"
	"gorm.io/gorm"
	"net/http"
	"os"

	// All the modules that we intend to use, even if we don't use them in the
	// web framework router.
	//
	// NOTE: Don't try to pass a list of module names to authboss.Init() if you reference
	// the module elsewhere in your code. This is a Path of Tears -- authboss will register
	// the module internally as being needed, ignoring your requested list.
	_ "github.com/volatiletech/authboss/v3/auth"
	_ "github.com/volatiletech/authboss/v3/remember"
	//_ "github.com/volatiletech/authboss/v3/confirm"
	//_ "github.com/volatiletech/authboss/v3/lock"
	_ "github.com/volatiletech/authboss/v3/logout"
	//_ "github.com/volatiletech/authboss/v3/recover"
	_ "github.com/volatiletech/authboss/v3/register"
)

var (
	assertUser   = &User{}
	assertStorer = &ServerStore{}

	_ authboss.User           = assertUser
	_ authboss.AuthableUser   = assertUser
	_ authboss.RememberValuer = assertUser
	_ authboss.UserValuer     = assertUser
	_ authboss.ArbitraryUser  = assertUser
	//_ authboss.ConfirmableUser = assertUser
	//_ authboss.LockableUser    = assertUser
	//_ authboss.RecoverableUser = assertUser

	// TBD: _ totp2fa.User = assertUser
	// TBD: _ sms2fa.User  = assertUser

	_ authboss.ServerStorer            = assertStorer
	_ authboss.RememberingServerStorer = assertStorer
	_ authboss.CreatingServerStorer    = assertStorer
	//_ authboss.ConfirmingServerStorer  = assertStorer
	//_ authboss.RecoveringServerStorer  = assertStorer
)

func SetupAuthboss(db *gorm.DB) (*authboss.Authboss, error) {
	ab := authboss.New()
	initAuthStores()
	defaults.SetCore(&ab.Config, true, false)

	ab.Config.Core.Router = defaults.NewRouter()
	ab.Config.Core.ErrorHandler = ABErrorHandler{}
	ab.Config.Core.ViewRenderer = defaults.JSONRenderer{}
	ab.Config.Core.Responder = defaults.NewResponder(ab.Config.Core.ViewRenderer)
	ab.Config.Core.Redirector = &defaults.Redirector{
		Renderer:           ab.Config.Core.ViewRenderer,
		FormValueName:      authboss.FormValueRedirect,
		CorceRedirectTo200: true,
	}
	ab.Config.Core.BodyReader = defaults.NewHTTPBodyReader(true, false)
	ab.Config.Core.Mailer = defaults.NewLogMailer(os.Stdout)
	ab.Config.Core.Logger = log.AuthbossLogger
	ab.Config.Paths.RootURL = "http://localhost:3000"
	ab.Config.Paths.Mount = "/auth"
	ab.Config.Paths.AuthLoginOK = "/projects"
	ab.Config.Paths.RegisterOK = "/login"
	//ab.Config.Core.Redirector = defaults.Redirector{}

	ab.Config.Storage.Server = NewAuthStore(db)
	ab.Config.Storage.SessionState = NewCookieStore("ab_session")
	ab.Config.Storage.CookieState = NewCookieStore("ab_cookie")
	ab.Config.Core.BodyReader = defaults.HTTPBodyReader{ReadJSON: true}

	ab.Config.Modules.RegisterPreserveFields = []string{"email"}
	ab.Config.Modules.LogoutMethod = "GET"

	registerHooks(ab)

	// Setup mail sender (you'll need to implement this)
	// ab.Config.Core.Mailer = NewMailer()

	// Initialize Authboss
	if err := ab.Init(); err != nil {
		return nil, err
	}

	return ab, nil
}

func registerHooks(ab *authboss.Authboss) {
	ab.Events.After(authboss.EventLogout, func(w http.ResponseWriter, r *http.Request, handled bool) (bool, error) {
		type RedirectResponse struct {
			Location string `json:"location"`
		}

		response := RedirectResponse{
			Location: "/login",
		}
		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			return false, err
		}
		return true, nil
	})
}
