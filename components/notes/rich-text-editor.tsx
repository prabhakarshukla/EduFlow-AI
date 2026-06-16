"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { 
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, 
  List, ListOrdered, Quote, Undo, Redo, Highlighter, Image as ImageIcon,
  Table as TableIcon, Pen
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onOpenDrawing: () => void;
  editorRef?: React.MutableRefObject<any>;
}

export function RichTextEditor({ content, onChange, onOpenDrawing, editorRef }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[400px] text-[var(--ui-text)] dark:prose-invert max-w-none",
      },
    },
  });

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // External content sync removed to fix typing cursor jumps and freezes.

  const [highlightColor, setHighlightColor] = React.useState('#ffc078');

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt("URL of the image:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const ToolbarButton = ({ onClick, isActive = false, disabled = false, icon: Icon, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
        isActive 
          ? "bg-teal-500/20 text-teal-500" 
          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: "1px solid var(--ui-border)", background: "var(--ui-surface-2)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--ui-border)", background: "var(--ui-bg)" }}>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} icon={Bold} title="Bold" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} icon={Italic} title="Italic" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} icon={Strikethrough} title="Strikethrough" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} icon={Code} title="Code" />
        
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/50 rounded-md p-0.5">
          <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: highlightColor }).run()} isActive={editor.isActive("highlight")} icon={Highlighter} title="Highlight" />
          <input 
            type="color" 
            value={highlightColor}
            onChange={(e) => setHighlightColor(e.target.value)}
            className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent mr-1"
            title="Highlight Color"
          />
        </div>
        
        <div className="h-5 w-px bg-gray-700 mx-1 flex-shrink-0" />
        
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} icon={Heading1} title="Heading 1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} icon={Heading2} title="Heading 2" />
        
        <div className="h-5 w-px bg-gray-700 mx-1 flex-shrink-0" />
        
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} icon={List} title="Bullet List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} icon={ListOrdered} title="Ordered List" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} icon={Quote} title="Blockquote" />
        
        <div className="h-5 w-px bg-gray-700 mx-1 flex-shrink-0" />
        
        <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={TableIcon} title="Insert Table" />
        <ToolbarButton onClick={onOpenDrawing} icon={Pen} title="Open Drawing Canvas" />
        <ToolbarButton onClick={addImage} icon={ImageIcon} title="Insert Image from URL" />
        
        <div className="h-5 w-px bg-gray-700 mx-1 flex-shrink-0" />
        
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={Undo} title="Undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={Redo} title="Redo" />
      </div>

      {/* Table Actions Toolbar */}
      {editor.isActive("table") && (
        <div className="flex items-center gap-2 p-2 overflow-x-auto bg-teal-500/10" style={{ borderBottom: "1px solid var(--ui-border)" }}>
          <span className="text-xs font-semibold px-2 text-teal-600 dark:text-teal-400">Table:</span>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Add Row</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">Delete Row</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Add Col</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">Delete Col</button>
          <div className="flex-1" />
          <button onClick={() => editor.chain().focus().deleteTable().run()} className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 font-medium transition-colors">Delete Table</button>
        </div>
      )}

      {/* Editor Content */}
      <div className="p-4 bg-white dark:bg-[#1a181a] max-h-[60vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
