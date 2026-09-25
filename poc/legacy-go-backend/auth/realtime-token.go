package auth

import (
	"analytics/database/types"
	"analytics/util"
	"errors"
	"gorm.io/gorm"
	"time"
)

type RealtimeToken struct {
	types.Base
	UserID UUID   `gorm:"type:varchar(36);index;not null" json:"-"`
	User   User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Token  string `gorm:"unique;not null"`
}

func CreateRealtimeToken(db *gorm.DB, userId UUID) (*RealtimeToken, error) {
	invalidAt := time.Now().Add(time.Minute * 10)
	token := &RealtimeToken{
		Base: types.Base{
			DeletedAt: gorm.DeletedAt{
				Time:  invalidAt,
				Valid: true,
			},
		},
		UserID: userId,
		Token:  util.RandSeq(64),
	}
	err := db.Create(token).Error
	return token, err
}

func ConsumeRealtimeToken(db *gorm.DB, token string) (*User, error) {
	now := time.Now()
	var rt RealtimeToken

	if err := db.
		Unscoped().
		Where("token = ? AND (deleted_at IS NULL OR deleted_at > ?)", token, now).
		Find(&rt).
		Error; err != nil {
		return nil, err
	}

	if rt.Token == "" {
		return nil, errors.New("token not found")
	}

	expired := now.Add(-15 * time.Minute)
	q := db.
		Model(&rt).
		Unscoped().
		Where("token = ?", token).
		Update("deleted_at", expired)
	if q.Error != nil || q.RowsAffected == 0 {
		return nil, q.Error
	}

	return &rt.User, nil
}
