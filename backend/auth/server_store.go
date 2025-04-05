package auth

import (
	"analytics/internal/log"
	"context"
	"errors"
	"github.com/volatiletech/authboss/v3"
	"gorm.io/gorm"
)

type ServerStore struct {
	db *gorm.DB
}

func NewAuthStore(db *gorm.DB) *ServerStore {
	return &ServerStore{db: db}
}

func (a *ServerStore) Load(ctx context.Context, key string) (authboss.User, error) {
	var user User
	log.Debug("Loading user with key %s", key)
	if err := a.db.Where("email = ?", key).Or("id = ?", key).First(&user).Error; err != nil {
		return nil, authboss.ErrUserNotFound
	}
	return &user, nil
}

func (a *ServerStore) Save(ctx context.Context, user authboss.User) error {
	u := user.(*User)
	log.Debug("Saving user %v", u)
	return a.db.Save(u).Error
}

func (a *ServerStore) AddRememberToken(ctx context.Context, pid string, token string) error {
	var user User
	err := a.db.Find(&user, "email = ?", pid).Error
	if err != nil {
		return err
	}
	rememberToken := RememberToken{
		UserID: user.ID,
		Token:  token,
	}
	return a.db.Create(&rememberToken).Error
}

func (a *ServerStore) DelRememberTokens(ctx context.Context, pid string) error {
	return a.db.Where("user_id = (SELECT id FROM users WHERE email = ?)", pid).Delete(&RememberToken{}).Error
}

func (a *ServerStore) UseRememberToken(ctx context.Context, pid string, token string) error {
	var rememberToken RememberToken
	if err := a.db.Preload("User").Where("token = ?", token).First(&rememberToken).Error; err != nil {
		return authboss.ErrTokenNotFound
	}
	if rememberToken.Token == "" {
		return authboss.ErrTokenNotFound
	}
	if err := a.db.Delete(&rememberToken).Error; err != nil {
		return err
	}
	return nil
}

// Additional required methods for authboss.ServerStorer interface

func (a *ServerStore) Create(ctx context.Context, user authboss.User) error {
	u := user.(*User)
	log.Debug("Creating user %v", u)
	var existingUsers []User
	a.db.Find(&existingUsers)
	if len(existingUsers) > 0 {
		return errors.New("only one user is allowed as of right now")
	}
	err := a.db.Create(u).Error
	return err
}

func (a *ServerStore) New(ctx context.Context) authboss.User {
	return &User{}
}

func (a *ServerStore) Delete(key string) error {
	return a.db.Where("email = ?", key).Delete(&User{}).Error
}
