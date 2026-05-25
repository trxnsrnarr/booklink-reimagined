import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Plus, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { listMyLibraries, createLibrary, toggleLibraryItem } from "@/lib/economy.functions";

export function AddToLibraryModal({ storyId, open, onClose }: { storyId: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchLibs = useServerFn(listMyLibraries);
  const createL = useServerFn(createLibrary);
  const toggleL = useServerFn(toggleLibraryItem);
  const [newName, setNewName] = useState("");

  const q = useQuery({ queryKey: ["my-libraries"], queryFn: () => fetchLibs(), enabled: open });
  const membership = q.data?.membership[storyId] ?? [];

  const create = useMutation({
    mutationFn: () => createL({ data: { name: newName.trim() } }),
    onSuccess: () => { setNewName(""); qc.invalidateQueries({ queryKey: ["my-libraries"] }); toast.success("Library dibuat."); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (libraryId: string) => toggleL({ data: { library_id: libraryId, story_id: storyId } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["my-libraries"] }); qc.invalidateQueries({ queryKey: ["library"] }); toast.success(r.added ? "Disimpan ke library." : "Dihapus dari library."); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-background border border-border rounded-3xl p-6 shadow-warm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold inline-flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Simpan ke Library</h2>
              <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-accent grid place-items-center"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {q.isLoading && <div className="skeleton h-12 rounded-xl" />}
              {q.data?.libraries.map((l) => {
                const inLib = membership.includes(l.id);
                return (
                  <button key={l.id} onClick={() => toggle.mutate(l.id)} disabled={toggle.isPending} className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass hover:bg-accent/40 transition disabled:opacity-50">
                    <div className="text-left">
                      <p className="font-medium text-sm">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.count} cerita</p>
                    </div>
                    <div className={`h-6 w-6 rounded-full grid place-items-center transition ${inLib ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                      {inLib && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Library baru..." className="flex-1 px-3 py-2 rounded-xl bg-input/60 border border-border outline-none focus:ring-2 focus:ring-primary/40 text-sm" />
              <button disabled={!newName.trim() || create.isPending} onClick={() => create.mutate()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"><Plus className="h-4 w-4" />Buat</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
