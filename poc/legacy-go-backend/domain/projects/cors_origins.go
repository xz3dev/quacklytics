package projects

import (
	"errors"
	"net/url"
	"slices"
	"strings"
)

func ParseCorsOrigins(value string) []string {
	origins := splitCorsOrigins(value)
	result := make([]string, 0, len(origins))
	seen := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		normalized, err := NormalizeCorsOrigin(origin)
		if err != nil {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func FormatCorsOrigins(origins []string) (string, error) {
	normalized := make([]string, 0, len(origins))
	seen := make(map[string]struct{}, len(origins))
	for _, origin := range origins {
		origin = strings.TrimSpace(origin)
		if origin == "" {
			continue
		}
		normalizedOrigin, err := NormalizeCorsOrigin(origin)
		if err != nil {
			return "", err
		}
		if _, exists := seen[normalizedOrigin]; exists {
			continue
		}
		seen[normalizedOrigin] = struct{}{}
		normalized = append(normalized, normalizedOrigin)
	}
	slices.Sort(normalized)
	return strings.Join(normalized, "\n"), nil
}

func FormatCorsOriginsValue(value string) (string, error) {
	return FormatCorsOrigins(splitCorsOrigins(value))
}

func NormalizeCorsOrigin(origin string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(origin))
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("CORS origins must start with http:// or https://")
	}
	if parsed.Host == "" {
		return "", errors.New("CORS origins must include a host")
	}
	if parsed.Path != "" && parsed.Path != "/" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("CORS origins must not include a path, query, or fragment")
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	parsed.Host = strings.ToLower(parsed.Host)
	parsed.Path = ""
	return parsed.String(), nil
}

func IsCorsOriginAllowed(settings map[ProjectSettingKey]string, origin string) bool {
	normalized, err := NormalizeCorsOrigin(origin)
	if err != nil {
		return false
	}
	return slices.Contains(ParseCorsOrigins(settings[CorsOrigins]), normalized)
}

func splitCorsOrigins(value string) []string {
	return strings.FieldsFunc(value, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == ';' || r == '\t'
	})
}
