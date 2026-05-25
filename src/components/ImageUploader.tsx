import { useCallback, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  bucket: "covers" | "chapter-images" | "avatars";
  userId: string;
  pathPrefix?: string;
  aspect?: "portrait" | "square" | "landscape";
  value?: string | null;
  onUploaded: (publicUrl: string) => void;
  className?: string;
  maxSizeMB?: number;
}

export function ImageUploader({ bucket, userId, pathPrefix, aspect = "portrait", value, onUploaded, className, maxSizeMB = 1 }: Props) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File harus gambar."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Maks 10MB."); return; }
    setBusy(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight: aspect === "portrait" ? 1200 : 1600,
        useWebWorker: true,
        initialQuality: 0.85,
      });
      const ext = (compressed.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const key = `${userId}/${pathPrefix ? pathPrefix + "-" : ""}${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(key, compressed, { upsert: true, contentType: compressed.type });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(key);
      setPreview(data.publicUrl);
      onUploaded(data.publicUrl);
      toast.success("Gambar berhasil diunggah.");
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "Gagal mengunggah gambar.");
    } finally {
      setBusy(false);
    }
  }, [bucket, userId, pathPrefix, aspect, maxSizeMB, onUploaded]);

  const aspectClass = aspect === "portrait" ? "aspect-[2/3]" : aspect === "square" ? "aspect-square" : "aspect-[16/9]";

  return (
    <div
      className={cn("relative w-full rounded-2xl overflow-hidden glass border-2 border-dashed transition-all", aspectClass, dragging ? "border-primary ring-2 ring-primary/40" : "border-border", className)}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
    >
      {preview ? (
        <>
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setPreview(null)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 opacity-0 hover:opacity-100 transition-opacity grid place-items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="px-4 py-2 rounded-full bg-white/90 text-black text-sm font-medium inline-flex items-center gap-2"><Upload className="h-4 w-4" />Ganti</button>
            <button type="button" onClick={() => { setPreview(null); onUploaded(""); }} className="px-4 py-2 rounded-full bg-destructive/90 text-white text-sm font-medium inline-flex items-center gap-2"><X className="h-4 w-4" />Hapus</button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="absolute inset-0 grid place-items-center text-center text-muted-foreground gap-2 disabled:opacity-60">
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImageIcon className="h-8 w-8 text-primary" />}
          <p className="text-sm font-medium">{busy ? "Mengunggah..." : "Klik atau seret gambar ke sini"}</p>
          <p className="text-xs">JPG/PNG/WEBP · maks 10MB</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}