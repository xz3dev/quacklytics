package insights // Or repository / store

import (
	"errors"
	"fmt"
	"gorm.io/gorm"
)

// Store defines the interface for insight data operations.
type Store interface {
	GetInsightByID(id uint) (*Insight, error) // Use uint for ID based on Insight struct
	ListInsights() ([]Insight, error)
	CreateInsight(input *InsightInput) (*Insight, error)
	UpdateInsight(id uint, input *InsightInput) (*Insight, error) // Use uint for ID
	DeleteInsight(id uint) error                                  // Use uint for ID
}

// insightStore implements the Store interface using GORM.
type insightStore struct {
	db *gorm.DB
}

// NewInsightStore creates a new instance of the insight store.
func NewInsightStore(db *gorm.DB) Store {
	return &insightStore{db: db}
}

// GetInsightByID retrieves a single insight by its ID.
func (s *insightStore) GetInsightByID(id uint) (*Insight, error) {
	var insight Insight
	result := s.db.First(&insight, id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("insight with ID %d not found: %w", id, result.Error)
		}
		return nil, fmt.Errorf("error fetching insight ID %d: %w", id, result.Error)
	}
	return &insight, nil
}

// ListInsights retrieves all insights.
func (s *insightStore) ListInsights() ([]Insight, error) {
	var insights []Insight
	result := s.db.Find(&insights)
	if result.Error != nil {
		return nil, fmt.Errorf("error listing insights: %w", result.Error)
	}
	return insights, nil
}

// CreateInsight creates a new insight record in the database.
func (s *insightStore) CreateInsight(input *InsightInput) (*Insight, error) {
	insight := Insight{
		InsightInput: *input,
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to begin transaction for create: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		} else if tx.Error != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Create(&insight).Error; err != nil {
		return nil, fmt.Errorf("failed to create insight: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction for create: %w", err)
	}

	return &insight, nil
}

// UpdateInsight updates an existing insight record.
func (s *insightStore) UpdateInsight(id uint, input *InsightInput) (*Insight, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to begin transaction for update: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		} else if tx.Error != nil {
			tx.Rollback()
		}
	}()

	var insight Insight
	if err := tx.First(&insight, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("insight with ID %d not found for update: %w", id, err)
		}
		return nil, fmt.Errorf("error fetching insight ID %d for update: %w", id, err)
	}

	insight.Apply(*input)

	if err := tx.Save(&insight).Error; err != nil {
		return nil, fmt.Errorf("failed to save updated insight (ID: %d): %w", id, err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction for update (ID: %d): %w", id, err)
	}

	return &insight, nil
}

// DeleteInsight removes an insight record.
func (s *insightStore) DeleteInsight(id uint) error {
	tx := s.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to begin transaction for delete: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		} else if tx.Error != nil {
			tx.Rollback()
		}
	}()

	result := tx.Delete(&Insight{}, id)
	if result.Error != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete insight ID %d: %w", id, result.Error)
	}

	if result.RowsAffected == 0 {
		tx.Rollback()
		return fmt.Errorf("insight with ID %d not found for deletion: %w", id, gorm.ErrRecordNotFound)
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction for delete (ID: %d): %w", id, err)
	}

	return nil
}
