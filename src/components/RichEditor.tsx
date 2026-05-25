import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import imageCompression from "browser-image-compression";
import { useRef, useEffect, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIco, Heading2, Heading3, Quote, List, ListOrdered,
  Image as ImageIco, Minus, Undo2, Redo2, Loader2,
  AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Image extension with resizable width attribute (preset or px/percent)
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || (el as HTMLElement).getAttribute("width") || null,
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { style: `width: ${attrs.width}; height: auto;` };
        },
      },
    };
  },
});

interface Props {
  value: string;
  onChange: (html: string) => void;
  userId: string;
  placeholder?: string;
  className?: string;
}

export function RichEditor({ value, onChange, userId, placeholder, className }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ResizableImage.configure({ HTMLAttributes: { class: "rounded-xl h-auto my-4 mx-auto block shadow-md max-w-full" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Tulis cerita kamu di sini..." }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "rich-editor-content prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[60vh] px-4 sm:px-8 py-8 font-serif leading-relaxed text-foreground caret-primary",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File harus gambar."); return; }
    setUploading(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, initialQuality: 0.85 });
      const ext = (compressed.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const key = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("chapter-images").upload(key, compressed, { upsert: true, contentType: compressed.type });
      if (error) throw error;
      const { data } = supabase.storage.from("chapter-images").getPublicUrl(key);
      editor?.chain().focus().setImage({ src: data.publicUrl }).run();
      toast.success("Gambar disisipkan.");
    } catch (e) {
      toast.error((e as Error).message || "Gagal mengunggah gambar.");
    } finally { setUploading(false); }
  };

  if (!editor) return <div className="skeleton h-72 rounded-xl" />;

  const Btn = ({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-9 w-9 grid place-items-center rounded-lg hover:bg-accent transition shrink-0 text-foreground/80",
        active && "bg-primary/15 text-primary"
      )}
    >
      {children}
    </button>
  );

  const imgActive = editor.isActive("image");
  const setImgWidth = (w: string | null) =>
    editor.chain().focus().updateAttributes("image", { width: w }).run();

  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 overflow-hidden shadow-sm flex flex-col", className)}>
      {/* Image resize bar — appears when an image is selected */}
      {imgActive && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-primary/5 text-xs flex-wrap">
          <span className="font-medium text-primary mr-1">Ukuran gambar:</span>
          <button type="button" onClick={() => setImgWidth("25%")} className="px-2.5 py-1 rounded-md hover:bg-accent border border-border">Kecil</button>
          <button type="button" onClick={() => setImgWidth("50%")} className="px-2.5 py-1 rounded-md hover:bg-accent border border-border">Sedang</button>
          <button type="button" onClick={() => setImgWidth("75%")} className="px-2.5 py-1 rounded-md hover:bg-accent border border-border">Besar</button>
          <button type="button" onClick={() => setImgWidth("100%")} className="px-2.5 py-1 rounded-md hover:bg-accent border border-border">Penuh</button>
          <button type="button" onClick={() => setImgWidth(null)} className="px-2.5 py-1 rounded-md hover:bg-accent border border-border ml-1 text-muted-foreground">Reset</button>
        </div>
      )}

      {/* Editor area first */}
      <div
        className="bg-background/40"
        onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("image/")) { e.preventDefault(); uploadImage(f); } }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Toolbar at the BOTTOM, sticky */}
      <div className="sticky bottom-0 z-20 flex items-center gap-0.5 overflow-x-auto px-2 py-2 border-t border-border bg-background/90 backdrop-blur-md shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]">
        <Btn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><UnderlineIco className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <Btn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
        <Btn title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <Btn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></Btn>
        <Btn title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <Btn title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })}><AlignLeft className="h-4 w-4" /></Btn>
        <Btn title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })}><AlignCenter className="h-4 w-4" /></Btn>
        <Btn title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })}><AlignRight className="h-4 w-4" /></Btn>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
        <Btn title="Insert image" onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIco className="h-4 w-4" />}</Btn>
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
          <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
    </div>
  );
}
