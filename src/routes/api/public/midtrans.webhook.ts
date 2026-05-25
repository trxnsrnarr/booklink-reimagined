import { createFileRoute } from "@tanstack/react-router";
import { handleMidtransNotification } from "./midtrans.notification";

// Friendly alias for Midtrans webhook URL configuration.
// Use either /api/public/midtrans/webhook or /api/public/midtrans/notification.
export const Route = createFileRoute("/api/public/midtrans/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMidtransNotification(request),
      GET: async () => new Response("ok"),
    },
  },
});