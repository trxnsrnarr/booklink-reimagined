import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { I18nProvider } from "@/hooks/use-i18n";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CursorGlow } from "@/components/CursorGlow";
import { FloatingBackground } from "@/components/FloatingBackground";
import { GameCenter } from "@/components/GameCenter";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-strong rounded-3xl p-10 shadow-warm">
        <h1 className="font-display text-7xl font-bold text-gradient-warm">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Halaman tidak ditemukan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cerita yang kamu cari mungkin sudah dipindahkan atau tidak ada.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary-glow px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:shadow-warm transition-all"
        >
          Kembali ke Home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass-strong rounded-3xl p-10 shadow-warm">
        <h1 className="font-display text-2xl font-semibold">Ups, halaman gagal dimuat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message ?? "Terjadi kesalahan tak terduga."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-gradient-to-r from-primary to-primary-glow px-5 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:shadow-warm transition-all"
          >
            Coba lagi
          </button>
          <a href="/" className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium hover:bg-accent/50 transition-all">
            Ke Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BookLink — Read, Write, Earn" },
      { name: "description", content: "Platform membaca & menulis cerita online modern. Romance, Fantasy, Horror, Sci-Fi. Dukung penulis favoritmu lewat coin." },
      { name: "author", content: "BookLink" },
      { property: "og:title", content: "BookLink — Read, Write, Earn" },
      { property: "og:description", content: "Platform membaca & menulis cerita online modern. Romance, Fantasy, Horror, Sci-Fi. Dukung penulis favoritmu lewat coin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BookLink — Read, Write, Earn" },
      { name: "twitter:description", content: "Platform membaca & menulis cerita online modern. Romance, Fantasy, Horror, Sci-Fi. Dukung penulis favoritmu lewat coin." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/18a7ddfa-c242-44e5-b894-94737c01a03c/id-preview-9a6189db--81e2c7cc-4f42-4d5f-94d8-9c3467d35c11.lovable.app-1779318978694.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/18a7ddfa-c242-44e5-b894-94737c01a03c/id-preview-9a6189db--81e2c7cc-4f42-4d5f-94d8-9c3467d35c11.lovable.app-1779318978694.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <FloatingBackground />
            <CursorGlow />
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Outlet />
              </main>
              <Footer />
            </div>
            <GameCenter />
            <Toaster position="top-center" richColors closeButton />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
