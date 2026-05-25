import { createFileRoute, Navigate } from "@tanstack/react-router";

// Friendly singular alias → redirects to the canonical /transactions/$orderId page.
export const Route = createFileRoute("/transaction/$orderId")({
  component: function TxAlias() {
    const { orderId } = Route.useParams();
    return <Navigate to="/transactions/$orderId" params={{ orderId }} replace />;
  },
});