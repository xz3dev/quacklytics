package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestRegistrationClosed(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	if err := db.AutoMigrate(&User{}); err != nil {
		t.Fatal(err)
	}
	store := NewAuthStore(db)
	if err := store.Create(context.Background(), &User{Email: "first@example.com", Password: "hash"}); err != nil {
		t.Fatal(err)
	}
	err = store.Create(context.Background(), &User{Email: "second@example.com", Password: "hash"})
	if !errors.Is(err, ErrRegistrationClosed) {
		t.Fatalf("expected registration closed, got %v", err)
	}
	w := httptest.NewRecorder()
	errorHandler{Handler: func(http.ResponseWriter, *http.Request) error {
		return fmt.Errorf("create user: %w", err)
	}}.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/register", nil))
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response["code"] != "registration_closed" || response["message"] != ErrRegistrationClosed.Error() {
		t.Fatalf("unexpected response: %v", response)
	}
	var count int64
	if err := db.Model(&User{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("expected one user, got %d (error: %v)", count, err)
	}
	if err := db.Migrator().DropTable(&User{}); err != nil {
		t.Fatal(err)
	}
	if err := store.Create(context.Background(), &User{Email: "third@example.com"}); err == nil || errors.Is(err, ErrRegistrationClosed) {
		t.Fatalf("expected database error, got %v", err)
	}
}
