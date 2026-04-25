import { createFileRoute } from "@tanstack/react-router";
import GuestDashboard from "@/pages/GuestDashboard";

export const Route = createFileRoute("/guest-dashboard")({
  component: GuestDashboard,
});
