import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/mini-games_/$gameId")({
  component: LegacyMiniGameRedirect,
});

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

function LegacyMiniGameRedirect() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const slug = LEGACY_GAME_SLUGS[gameId] ?? gameId;

  useEffect(() => {
    console.info(`[BookLink Arcade] legacy gameplay route redirected: /mini-games/${gameId} -> /mini-games/${slug}/play`);
    navigate({ to: "/mini-games/$gameId/play", params: { gameId: slug }, replace: true });
  }, [gameId, navigate, slug]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Membuka gameplay…</p>
    </div>
  );
}