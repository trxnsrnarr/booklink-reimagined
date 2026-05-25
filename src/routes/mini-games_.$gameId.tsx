import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mini-games_/$gameId")({
  component: MiniGameLayout,
});

function MiniGameLayout() {
  return <Outlet />;
}