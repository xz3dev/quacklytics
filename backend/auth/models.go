package auth

import (
	"analytics/model"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

// UUID is a custom type that wraps uuid.UUID
type UUID struct {
	uuid.UUID
}

// Value implements the driver.Valuer interface
func (u UUID) Value() (driver.Value, error) {
	return u.UUID.String(), nil
}

// Scan implements the sql.Scanner interface
func (u *UUID) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("invalid UUID format")
	}
	uuid, err := uuid.Parse(s)
	if err != nil {
		return err
	}
	u.UUID = uuid
	return nil
}

// MarshalJSON implements the json.Marshaler interface
func (u UUID) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.UUID.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface
func (u *UUID) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	uuid, err := uuid.Parse(s)
	if err != nil {
		return err
	}
	u.UUID = uuid
	return nil
}

type User struct {
	ID        UUID           `gorm:"type:varchar(36);primary_key;not null"`
	Email     string         `gorm:"unique;not null"`
	Password  string         `gorm:"not null"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

type RememberToken struct {
	model.Base
	UserID UUID   `gorm:"type:varchar(36);index;not null"`
	User   User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Token  string `gorm:"unique;not null"`
}

type RecoveryToken struct {
	model.Base
	UserID    UUID      `gorm:"type:varchar(36);index;not null"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE"`
	Token     string    `gorm:"unique;not null"`
	ExpiresAt time.Time `gorm:"not null"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID.UUID == uuid.Nil {
		u.ID = UUID{uuid.New()}
	}
	return nil
}

func (u *User) GetPID() string {
	return u.ID.String()
}

func (u *User) GetShouldRemember() bool {
	return true
}

func (u *User) PutPID(pid string) {
	uuid, err := uuid.Parse(pid)
	if err != nil {
		return
	}
	u.ID = UUID{uuid}
}

func (u *User) GetPassword() string {
	return u.Password
}

func (u *User) PutPassword(password string) {
	u.Password = password
}
