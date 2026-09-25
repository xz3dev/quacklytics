package util

import (
	"fmt"
	"os"
)

func ClearDirectory(path string) error {
	// Check if the directory exists and clear its contents if any
	if _, err := os.Stat(path); err == nil {
		files, err := os.ReadDir(path)
		if err != nil {
			return fmt.Errorf("failed to read directory %s: %w", path, err)
		}

		for _, file := range files {
			err := os.RemoveAll(fmt.Sprintf("%s/%s", path, file.Name()))
			if err != nil {
				return fmt.Errorf("failed to delete file %s: %w", file.Name(), err)
			}
		}
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("failed to access directory %s: %w", path, err)
	}

	// Create the directory if it doesn't exist
	err := os.MkdirAll(path, os.ModePerm)
	if err != nil {
		return fmt.Errorf("failed to create directory %s: %w", path, err)
	}
	return nil
}

func EnsureDirectory(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		err := os.MkdirAll(path, os.ModePerm)
		if err != nil {
			return fmt.Errorf("failed to create directory %s: %w", path, err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to access directory %s: %w", path, err)
	}
	return nil
}
