import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookOpen, Coins, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — BookLink" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold">Tentang BookLink</h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          BookLink adalah platform creator economy untuk pembaca dan penulis cerita online. Kami percaya bahwa setiap cerita layak dibaca, dan setiap penulis layak dihargai.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-4">
          {[
            { icon: BookOpen, title: "Baca tanpa batas", desc: "Ribuan cerita dari berbagai genre, gratis dan premium." },
            { icon: Coins, title: "Coin economy", desc: "Top-up koin via Midtrans, unlock chapter berbayar — 100% earning untuk author." },
            { icon: Heart, title: "Dukung kreator", desc: "70% revenue langsung ke author. Adil dan transparan." },
            { icon: Sparkles, title: "Pengalaman premium", desc: "Reading mode immersive, custom theme, dan banyak lagi." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
