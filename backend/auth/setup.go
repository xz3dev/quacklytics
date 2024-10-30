package auth

import (
	"github.com/volatiletech/authboss/v3"
	"github.com/volatiletech/authboss/v3/defaults"
	"gorm.io/gorm"
	"log"
	"net/http"

	// All of the modules that we intend to use, even if we don't use them in the
	// web framework router.
	//
	// NOTE: Don't try to pass a list of module names to authboss.Init() if you reference
	// the module elsewhere in your code. This is a Path of Tears -- authboss will register
	// the module internally as being needed, ignoring your requested list.
	_ "github.com/volatiletech/authboss/v3/auth"
	_ "github.com/volatiletech/authboss/v3/remember"
	//_ "github.com/volatiletech/authboss/v3/confirm"
	//_ "github.com/volatiletech/authboss/v3/lock"
	//_ "github.com/volatiletech/authboss/v3/logout"
	//_ "github.com/volatiletech/authboss/v3/recover"
	//_ "github.com/volatiletech/authboss/v3/register"
)

func SetupAuthboss(db *gorm.DB) (*authboss.Authboss, error) {
	ab := authboss.New()

	ab.Config.Paths.RootURL = "http://localhost:3000"
	ab.Config.Paths.Mount = "/auth"
	ab.Config.Paths.AuthLoginOK = "/app"

	ab.Events.Before(authboss.EventAuth, func(w http.ResponseWriter, r *http.Request, handled bool) (bool, error) {
		log.Printf("Auth attempt: %+v", r.Form)
		return false, nil
	})

	initAuthStores()

	ab.Config.Storage.Server = NewAuthStore(db)
	ab.Config.Storage.SessionState = NewCookieStore("ab_session")
	ab.Config.Storage.CookieState = NewCookieStore("ab_cookie")
	ab.Config.Core.BodyReader = defaults.HTTPBodyReader{ReadJSON: true}

	ab.Config.Modules.RegisterPreserveFields = []string{"email"}
	ab.Config.Modules.LogoutMethod = "GET"

	ab.Config.Core.ViewRenderer = defaults.JSONRenderer{}
	defaults.SetCore(&ab.Config, true, false)

	// Setup mail sender (you'll need to implement this)
	// ab.Config.Core.Mailer = NewMailer()

	// Initialize Authboss
	if err := ab.Init(); err != nil {
		return nil, err
	}

	return ab, nil
}

var (
	assertUser   = &User{}
	assertStorer = &ServerStore{}

	_ authboss.User           = assertUser
	_ authboss.AuthableUser   = assertUser
	_ authboss.RememberValuer = assertUser
	//_ authboss.ConfirmableUser = assertUser
	//_ authboss.LockableUser    = assertUser
	//_ authboss.RecoverableUser = assertUser
	//_ authboss.ArbitraryUser   = assertUser

	// TBD: _ totp2fa.User = assertUser
	// TBD: _ sms2fa.User  = assertUser

	_ authboss.ServerStorer            = assertStorer
	_ authboss.RememberingServerStorer = assertStorer
	//_ authboss.CreatingServerStorer    = assertStorer
	//_ authboss.ConfirmingServerStorer  = assertStorer
	//_ authboss.RecoveringServerStorer  = assertStorer
)
