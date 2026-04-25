import { createFileRoute, redirect } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getSession()) {
      throw redirect({ to: "/" });
    }
  },
  component: Dashboard,
});
