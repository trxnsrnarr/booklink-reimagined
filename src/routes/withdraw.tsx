import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/withdraw")({
  component: () => <Navigate to="/dashboard" />,
});
