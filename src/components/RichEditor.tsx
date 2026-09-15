// ---------------------------------------------------------------------------
// RichEditor — editor TipTap para o Painel do Autor
// Barra de formatação: negrito, itálico, cabeçalho H2/H3, lista, citação
// Corpo sai como HTML — já compatível com dangerouslySetInnerHTML na página da obra
// ---------------------------------------------------------------------------

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
} from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxChars?: number;
}

export function RichEditor({
  value,
  onChange,
  placeholder = "Escreva ou descreva sua obra aqui…",
  maxChars = 50000,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // desativa os que não usamos
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxChars }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] px-4 py-3 text-sm leading-relaxed outline-none prose prose-invert max-w-none focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sincroniza valor externo (reset após submit)
  useEffect(() => {
    if (!editor) return;
    if (value === "" && editor.getText() !== "") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  const chars = editor.storage.characterCount.characters();

  return (
    <div className="border border-border transition-colors focus-within:border-gilt">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface px-2 py-1.5">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </ToolBtn>

        <Divider />

        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título H2"
        >
          <Heading2 className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subtítulo H3"
        >
          <Heading3 className="size-3.5" />
        </ToolBtn>

        <Divider />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
        >
          <List className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citação"
        >
          <Quote className="size-3.5" />
        </ToolBtn>

        <Divider />

        <ToolBtn
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="size-3.5" />
        </ToolBtn>
        <ToolBtn
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 className="size-3.5" />
        </ToolBtn>

        <span className="ml-auto text-[11px] text-muted-foreground/60 tabular-nums">
          {chars.toLocaleString("pt-BR")}/{maxChars.toLocaleString("pt-BR")}
        </span>
      </div>

      {/* ── Área de edição ── */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Auxiliares ──────────────────────────────────────────────────────────────

function ToolBtn({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex items-center justify-center rounded px-2 py-1.5 transition-colors",
        active
          ? "bg-gilt/20 text-gilt"
          : "text-muted-foreground hover:bg-background hover:text-foreground",
        disabled ? "opacity-30 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border" />;
}
