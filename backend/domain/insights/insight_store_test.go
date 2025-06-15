package insights // Or insights_test if using separate test package

import (
	"analytics/database/testsetup"
	"errors"
	"github.com/zeebo/assert"
	"gorm.io/gorm"
	"testing"
)

func setupDB(t *testing.T) *gorm.DB {
	setup := testsetup.Setup(t, testsetup.TestSetupConfig{ProjectDB: true})
	err := setup.ProjectDB.AutoMigrate(&Insight{})
	assert.NoError(t, err)
	return setup.ProjectDB
}

func errorIs(t *testing.T, err error, target error) {
	assert.True(t, errors.Is(err, target))
}

func TestInsightStore_CreateInsight(t *testing.T) {
	db := setupDB(t)
	store := NewInsightStore(db) // Use NewInsightStore directly

	isFavorite := false

	input := &InsightInput{ // Use types directly
		Name:     "Test Create Insight",
		Type:     Trend, // Assuming Trend is a defined InsightType constant
		Favorite: &isFavorite,
		Config: &InsightConfig{
			TrendConf: &TrendInsightConfig{
				TimeBucket: Daily,
				Duration:   "P7D",
				Series: &[]TrendSeries{
					{Name: "Series A", Visualisation: "line", Query: InsightQuery{}},
				},
			},
		},
	}

	created, err := store.CreateInsight(input)

	// Assertions for CreateInsight result
	assert.NoError(t, err)
	assert.NotNil(t, created)
	//assert.NotEqual(t, uint(0), created.ID, "Expected ID to be populated")
	assert.Equal(t, input.Name, created.Name)
	assert.Equal(t, input.Type, created.Type)
	assert.Equal(t, input.Favorite, created.Favorite)
	assert.DeepEqual(t, input.Config, created.Config) // Compare complex structs
	// assert.False(t, created.CreatedAt.IsZero()) // Optional: check timestamps
	// assert.False(t, created.UpdatedAt.IsZero())

	// Verify persistence by fetching directly from DB
	var fetched Insight
	result := db.First(&fetched, created.ID)
	assert.NoError(t, result.Error)
	assert.Equal(t, created.Name, fetched.Name)
	assert.DeepEqual(t, created.Config, fetched.Config)
}

func TestInsightStore_GetInsightByID(t *testing.T) {
	t.Run("NotFound", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		fetchedNotFound, errNotFound := store.GetInsightByID(999) // Use a non-existent ID
		errorIs(t, errNotFound, gorm.ErrRecordNotFound)
		assert.Nil(t, fetchedNotFound)
	})

	// --- Scenario: Found ---
	t.Run("Found", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		// Prepare data
		input := &InsightInput{Name: "Test Get Insight", Type: Trend, Config: &InsightConfig{}}
		created, errCreate := store.CreateInsight(input)
		assert.NoError(t, errCreate)
		assert.NotNil(t, created)

		// Test Get
		fetchedFound, errFound := store.GetInsightByID(created.ID)
		assert.NoError(t, errFound)
		assert.NotNil(t, fetchedFound)
		assert.Equal(t, created.ID, fetchedFound.ID)
		assert.Equal(t, input.Name, fetchedFound.Name)
		assert.Equal(t, input.Type, fetchedFound.Type)
		assert.DeepEqual(t, input.Config, fetchedFound.Config)
	})
}

func TestInsightStore_ListInsights(t *testing.T) {
	// --- Scenario: Empty List ---
	t.Run("Empty", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		listEmpty, errEmpty := store.ListInsights()
		assert.NoError(t, errEmpty)
		assert.NotNil(t, listEmpty)
		assert.Equal(t, 0, len(listEmpty))
	})

	// --- Scenario: List with Items ---
	t.Run("WithItems", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		// Prepare data
		input1 := &InsightInput{Name: "List Item 1", Type: Trend, Config: &InsightConfig{}}
		input2 := &InsightInput{Name: "List Item 2", Type: Trend, Config: &InsightConfig{}}
		_, err1 := store.CreateInsight(input1)
		_, err2 := store.CreateInsight(input2)
		assert.NoError(t, err1)
		assert.NoError(t, err2)

		// Test List
		listFull, errFull := store.ListInsights()
		assert.NoError(t, errFull)
		assert.NotNil(t, listFull)
		assert.Equal(t, 2, len(listFull))

		// Verify content (optional but recommended)
		names := make(map[string]bool)
		for _, item := range listFull {
			names[item.Name] = true
		}
		assert.True(t, names[input1.Name])
		assert.True(t, names[input2.Name])
	})
}

func TestInsightStore_UpdateInsight(t *testing.T) {
	// --- Scenario: Not Found ---
	t.Run("NotFound", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		updateInputNotFound := &InsightInput{Name: "Update Non Existent"}
		updatedNotFound, errNotFound := store.UpdateInsight(999, updateInputNotFound)
		errorIs(t, errNotFound, gorm.ErrRecordNotFound)
		assert.Nil(t, updatedNotFound)
	})

	isFavorite := false

	// --- Scenario: Found and Updated ---
	t.Run("FoundAndUpdate", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		// Prepare initial data
		initialInput := &InsightInput{
			Name:     "Initial Name",
			Type:     Trend,
			Favorite: &isFavorite,
			Config:   &InsightConfig{TrendConf: &TrendInsightConfig{Duration: "P1D"}},
		}
		created, errCreate := store.CreateInsight(initialInput)
		assert.NoError(t, errCreate)
		assert.NotNil(t, created)

		isFavoriteTrue := true
		// Prepare update data
		updateInput := &InsightInput{
			Name:     "Updated Name",
			Type:     Trend, // Usually type doesn't change, keep consistent or test changing it if allowed
			Favorite: &isFavoriteTrue,
			Config:   &InsightConfig{TrendConf: &TrendInsightConfig{Duration: "P2D", TimeBucket: Weekly}}, // Changed config
		}

		// Test Update
		updated, errUpdate := store.UpdateInsight(created.ID, updateInput)
		assert.NoError(t, errUpdate)
		assert.NotNil(t, updated)
		assert.Equal(t, created.ID, updated.ID)
		assert.Equal(t, updateInput.Name, updated.Name)
		assert.Equal(t, updateInput.Favorite, updated.Favorite)
		assert.DeepEqual(t, updateInput.Config, updated.Config)
		// assert.True(t, updated.UpdatedAt.After(created.UpdatedAt), "UpdatedAt timestamp should be newer") // Optional check

		// Verify persistence
		var fetched Insight
		result := db.First(&fetched, created.ID)
		assert.NoError(t, result.Error)
		assert.Equal(t, updateInput.Name, fetched.Name)
		assert.Equal(t, updateInput.Favorite, fetched.Favorite)
		assert.DeepEqual(t, updateInput.Config, fetched.Config)
	})
}

func TestInsightStore_DeleteInsight(t *testing.T) {

	// --- Scenario: Not Found ---
	t.Run("NotFound", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		errNotFound := store.DeleteInsight(999) // Non-existent ID

		doesErrMatch := errors.Is(errNotFound, gorm.ErrRecordNotFound)
		assert.True(t, doesErrMatch)
	})

	// --- Scenario: Found and Deleted ---
	t.Run("FoundAndDelete", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		// Prepare data
		input := &InsightInput{Name: "To Be Deleted", Type: Trend, Config: &InsightConfig{}}
		created, errCreate := store.CreateInsight(input)
		assert.NoError(t, errCreate)
		assert.NotNil(t, created)
		createdID := created.ID

		// Test Delete
		errDelete := store.DeleteInsight(createdID)
		assert.NoError(t, errDelete)

		// Verify deletion by trying to fetch
		var fetched Insight
		result := db.First(&fetched, createdID)
		assert.Error(t, result.Error)
		errorIs(t, result.Error, gorm.ErrRecordNotFound)
	})

	// --- Scenario: Delete Again ---
	t.Run("DeleteAgain", func(t *testing.T) {
		db := setupDB(t)
		store := NewInsightStore(db)
		// Prepare data
		input := &InsightInput{Name: "Delete Me Twice", Type: Trend, Config: &InsightConfig{}}
		created, _ := store.CreateInsight(input) // Ignore error for setup simplicity here
		createdID := created.ID

		// Delete first time (should succeed)
		errDelete1 := store.DeleteInsight(createdID)
		assert.NoError(t, errDelete1)

		// Test Delete again (should fail with not found)
		errDelete2 := store.DeleteInsight(createdID)
		errorIs(t, errDelete2, gorm.ErrRecordNotFound)
	})
}
