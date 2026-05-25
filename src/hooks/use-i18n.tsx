import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "id" | "en";

const DICT = {
  // Navbar
  "nav.home": { id: "Beranda", en: "Home" },
  "nav.explore": { id: "Jelajahi", en: "Explore" },
  "nav.library": { id: "Pustaka", en: "Library" },
  "nav.wallet": { id: "Dompet", en: "Wallet" },
  "nav.write": { id: "Tulis", en: "Write" },
  "nav.about": { id: "Tentang", en: "About" },
  "nav.notifications": { id: "Notifikasi", en: "Notifications" },
  "nav.profile": { id: "Profil", en: "Profile" },
  "nav.myStories": { id: "Cerita Saya", en: "My Stories" },
  "nav.transactions": { id: "Transaksi", en: "Transactions" },
  "nav.settings": { id: "Pengaturan", en: "Settings" },
  "nav.logout": { id: "Keluar", en: "Logout" },
  "nav.login": { id: "Masuk", en: "Login" },
  "nav.signup": { id: "Daftar", en: "Sign Up" },
  "nav.coins": { id: "koin", en: "coins" },

  // Hero
  "hero.tag": { id: "Platform creator economy untuk cerita modern", en: "Modern creator-economy platform for stories" },
  "hero.welcome": { id: "Selamat datang di", en: "Welcome to" },
  "hero.desc": { id: "Baca, tulis, dan hasilkan dari cerita. Dari romance hangat hingga sci-fi mendebarkan, semuanya ada di sini.", en: "Read, write, and earn from stories. From cozy romance to thrilling sci-fi, it's all here." },
  "hero.cta.read": { id: "Mulai Membaca", en: "Start Reading" },
  "hero.cta.write": { id: "Jadi Penulis", en: "Become a Writer" },

  // Sections
  "section.trending": { id: "Sedang Trending", en: "Trending Now" },
  "section.recommended": { id: "Rekomendasi Untukmu", en: "Recommended for You" },
  "section.premium": { id: "Cerita Premium", en: "Premium Stories" },
  "section.latest": { id: "Rilis Terbaru", en: "Latest Releases" },
  "section.seeAll": { id: "Lihat semua", en: "See all" },

  // Common
  "common.loading": { id: "Memuat...", en: "Loading..." },
  "common.save": { id: "Simpan", en: "Save" },
  "common.cancel": { id: "Batal", en: "Cancel" },
  "common.publish": { id: "Terbitkan", en: "Publish" },
  "common.draft": { id: "Draf", en: "Draft" },
  "common.back": { id: "Kembali", en: "Back" },
  "common.search": { id: "Cari", en: "Search" },
  "common.theme.light": { id: "Mode Terang", en: "Light Mode" },
  "common.theme.dark": { id: "Mode Gelap", en: "Dark Mode" },
  "common.lang": { id: "Bahasa", en: "Language" },
  "common.notFound": { id: "Tidak ditemukan", en: "Not found" },

  // Reader
  "reader.fontSize": { id: "Ukuran Font", en: "Font Size" },
  "reader.lineHeight": { id: "Jarak Baris", en: "Line Height" },
  "reader.theme": { id: "Tema Baca", en: "Reading Theme" },
  "reader.prev": { id: "Sebelumnya", en: "Previous" },
  "reader.next": { id: "Berikutnya", en: "Next" },
  "reader.unlock": { id: "Buka chapter ({coin} koin)", en: "Unlock chapter ({coin} coins)" },
  "reader.premium": { id: "Chapter premium", en: "Premium chapter" },

  // Editor
  "editor.newStory": { id: "Cerita Baru", en: "New Story" },
  "editor.newChapter": { id: "Chapter Baru", en: "New Chapter" },
  "editor.title": { id: "Judul", en: "Title" },
  "editor.synopsis": { id: "Sinopsis", en: "Synopsis" },
  "editor.genre": { id: "Genre", en: "Genre" },
  "editor.content": { id: "Konten", en: "Content" },
  "editor.coinPrice": { id: "Harga (koin)", en: "Price (coins)" },
  "editor.isPremium": { id: "Chapter premium", en: "Premium chapter" },
  "editor.empty": { id: "Belum ada cerita. Buat yang pertama!", en: "No stories yet. Create your first one!" },

  // Notifications
  "notif.empty": { id: "Belum ada notifikasi.", en: "No notifications yet." },
  "notif.markAll": { id: "Tandai semua dibaca", en: "Mark all as read" },

  // Settings
  "settings.title": { id: "Pengaturan", en: "Settings" },
  "settings.appearance": { id: "Tampilan", en: "Appearance" },
  "settings.appearanceDesc": { id: "Atur tema dan bahasa.", en: "Manage theme and language." },
  "settings.account": { id: "Akun", en: "Account" },
  "settings.signedAs": { id: "Masuk sebagai", en: "Signed in as" },
} as const;

type Key = keyof typeof DICT;

interface I18nCtx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string; }
const Ctx = createContext<I18nCtx>({ lang: "id", setLang: () => {}, t: (k) => String(k) });

const STORAGE_KEY = "booklink-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "id" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((k: Key, vars?: Record<string, string | number>) => {
    let s: string = (DICT[k]?.[lang] as string) ?? String(k);
    if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv));
    return s;
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
