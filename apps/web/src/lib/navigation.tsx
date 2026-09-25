import {
  Link,
  Outlet,
  Navigate,
  useNavigate as useRouterNavigate,
  useLocation,
  useParams as useRouterParams,
} from "@tanstack/react-router";
import { useCallback } from "react";
export { Link, Outlet, Navigate, useLocation };
export function useNavigate() {
  const navigate = useRouterNavigate();
  return useCallback((to: string) => navigate({ to }), [navigate]);
}
export function useParams() {
  return useRouterParams({ strict: false });
}
export function useMatch(pattern: string) {
  const location = useLocation();
  const actual = location.pathname.split("/").filter(Boolean),
    expected = pattern.split("/").filter(Boolean);
  if (actual.length !== expected.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    const part = expected[i],
      value = actual[i];
    if (!part || !value) return null;
    if (part.startsWith(":")) params[part.slice(1)] = value;
    else if (part !== value) return null;
  }
  return { params };
}
