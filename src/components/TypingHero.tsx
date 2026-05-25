import { useEffect, useState } from "react";

const WORDS = ["BookLink", "Online Stories", "Creator Platform"];

export function TypingHero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = WORDS[wordIndex];
    const speed = deleting ? 50 : 110;
    const pause = deleting ? 400 : 1500;

    if (!deleting && text === current) {
      const t = setTimeout(() => setDeleting(true), pause);
      return () => clearTimeout(t);
    }
    if (deleting && text === "") {
      setDeleting(false);
      setWordIndex((i) => (i + 1) % WORDS.length);
      return;
    }
    const t = setTimeout(() => {
      setText((prev) =>
        deleting ? current.substring(0, prev.length - 1) : current.substring(0, prev.length + 1)
      );
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, wordIndex]);

  return (
    <span className="text-gradient-warm cursor-caret inline-block min-h-[1.1em]">
      {text || "\u00A0"}
    </span>
  );
}
