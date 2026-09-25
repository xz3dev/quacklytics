package auth

import (
	"analytics/database/types"
	"analytics/log"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type User struct {
	ID        UUID           `gorm:"type:varchar(36);primary_key;not null" json:"id"`
	Email     string         `gorm:"unique;not null" json:"email"`
	Password  string         `gorm:"not null" json:"-"`
	CreatedAt time.Time      `json:"createdAt" json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

func (u *User) GetValues() map[string]string {
	values := map[string]string{}
	return values
}

type RememberToken struct {
	types.Base
	UserID UUID   `gorm:"type:varchar(36);index;not null"`
	User   User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Token  string `gorm:"unique;not null"`
}

type RecoveryToken struct {
	types.Base
	UserID    UUID      `gorm:"type:varchar(36);index;not null"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Token     string    `gorm:"unique;not null"`
	ExpiresAt time.Time `gorm:"not null"`
}

func (u *User) Validate() []error {
	log.Info("Validate %v", u)
	return nil
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID.UUID == uuid.Nil {
		u.ID = UUID{uuid.New()}
	}
	return nil
}

func (u *User) GetPID() string {
	return u.Email
}

func (u *User) GetShouldRemember() bool {
	return true
}

func (u *User) PutPID(pid string) {
	u.Email = pid
}

func (u *User) GetPassword() string {
	return u.Password
}

func (u *User) PutPassword(password string) {
	u.Password = password
}

func (u *User) PutArbitrary(arbitrary map[string]string) {
}

func (u *User) GetArbitrary() map[string]string {
	data := make(map[string]string)
	return data
}
