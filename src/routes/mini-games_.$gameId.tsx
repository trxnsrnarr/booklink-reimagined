import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/mini-games_/$gameId")({
  component: MiniGameLayout,
});

function MiniGameLayout() {
  const { gameId } = Route.useParams();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.endsWith("/play")) return;
    const slug = LEGACY_GAME_SLUGS[gameId] ?? gameId;
    console.info(`[BookLink Arcade] legacy gameplay route redirected: /mini-games/${gameId} -> /mini-games/${slug}/play`);
    navigate({ to: "/mini-games/$gameId/play", params: { gameId: slug }, replace: true });
  }, [gameId, location.pathname, navigate]);

  return <Outlet />;
}

const LEGACY_GAME_SLUGS: Record<string, string> = {
  flappy: "flappy-bookbird",
  "flappy-bookbird": "flappy-bookbird",
  memory: "memory-match",
  "memory-match": "memory-match",
  reflex: "reflex-strike",
  "reflex-strike": "reflex-strike",
  tap: "target-hunt",
  "tap-frenzy": "target-hunt",
  "target-hunt": "target-hunt",
  puzzle: "puzzle",
  "number-rush": "puzzle",
};