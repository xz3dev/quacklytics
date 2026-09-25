import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/app/landing/landing";
export const Route = createFileRoute("/")({ ssr: false, component: Landing });
