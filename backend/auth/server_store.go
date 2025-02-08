package auth

import (
	"analytics/log"
	"context"
	"errors"
	"github.com/google/uuid"
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
		return nil, err
	}
	return &user, nil
}

func (a *ServerStore) Save(ctx context.Context, user authboss.User) error {
	u := user.(*User)
	return a.db.Save(u).Error
}

func (a *ServerStore) AddRememberToken(ctx context.Context, pid string, token string) error {
	uuid, err := uuid.Parse(pid) // Assuming pid is now the UUID string
	if err != nil {
		return err
	}
	rememberToken := RememberToken{
		UserID: UUID{uuid},
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
		return err
	}
	if err := a.db.Delete(&rememberToken).Error; err != nil {
		return err
	}
	return nil
}

// Additional required methods for authboss.ServerStorer interface

func (a *ServerStore) Create(ctx context.Context, user authboss.User) error {
	u := user.(*User)
	log.Info("Creating user %v", u)
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
