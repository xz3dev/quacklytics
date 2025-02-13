package auth

import (
	"analytics/model"
	"analytics/util"
	"gorm.io/gorm"
	"time"
)

type RealtimeToken struct {
	model.Base
	UserID UUID   `gorm:"type:varchar(36);index;not null" json:"-"`
	User   User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Token  string `gorm:"unique;not null"`
}

func CreateRealtimeToken(db *gorm.DB, userId UUID) *RealtimeToken {
	invalidAt := time.Now().Add(time.Minute * 10)
	token := &RealtimeToken{
		Base: model.Base{
			DeletedAt: gorm.DeletedAt{
				Time:  invalidAt,
				Valid: true,
			},
		},
		UserID: userId,
		Token:  util.RandSeq(64),
	}
	db.Create(token)
	return token
}

func ConsumeToken(db *gorm.DB, token string) (*UUID, error) {
	var rt RealtimeToken
	if err := db.Where("token = ?", token).First(&rt).Error; err != nil {
		return nil, err
	}
	rt.DeletedAt.Time = time.Now()
	db.Updates(rt)
	return &rt.UserID, nil
}
