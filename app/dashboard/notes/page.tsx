"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import { supabase } from "../../../lib/supabase";
import { parseNoteBlocks, stripInlineMarkdown } from "@/utils/noteFormatting";

import { marked } from "marked";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { DrawingCanvas } from "@/components/notes/drawing-canvas";
import { useFeatureStatus } from "@/hooks/useFeatureStatus";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";


type NoteRow = {
  id: string;
  title: string;
  content: string;
  subject: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 transition-all duration-200 ${className}`}
      style={{
        background: "var(--ui-surface)",
        border: "1px solid var(--ui-border)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-widest mb-4"
      style={{ color: "var(--ui-muted)" }}
    >
      {children}
    </p>
  );
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
};

const exportNoteToPdf = (note: NoteRow) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    doc.setFillColor(110, 231, 216);
    doc.rect(margin, yPosition, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EduFlow AI", margin + 5, yPosition + 6);
    yPosition += 12;

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(
      note.title || "Untitled Note",
      contentWidth,
    ) as string[];
    doc.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 8 + 4;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    const createdDate = new Date(note.created_at).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );
    const metadataText = `Subject: ${note.subject || "General"} • Created: ${createdDate}`;
    doc.text(metadataText, margin, yPosition);
    yPosition += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    const ensureSpace = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    const writeWrappedText = (
      text: string,
      xPosition: number,
      maxWidth: number,
      lineHeight = 5,
    ) => {
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      lines.forEach((line: string) => {
        ensureSpace(lineHeight);
        doc.text(line, xPosition, yPosition);
        yPosition += lineHeight;
      });
    };

    const blocks = parseNoteBlocks(note.content || "");
    if (blocks.length === 0) {
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "italic");
      writeWrappedText("No content available for this note.", margin, contentWidth);
    }

    blocks.forEach((block) => {
      if (block.type === "heading") {
        yPosition += 2;
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(block.level === 1 ? 15 : block.level === 2 ? 13 : 12);
        writeWrappedText(block.text, margin, contentWidth, 6);
        yPosition += 1;
        return;
      }

      if (block.type === "list") {
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        block.items.forEach((item, itemIndex) => {
          const marker = block.ordered ? `${itemIndex + 1}.` : "-";
          ensureSpace(5);
          doc.text(marker, margin, yPosition);
          writeWrappedText(
            stripInlineMarkdown(item),
            margin + 6,
            contentWidth - 6,
            5,
          );
        });
        yPosition += 2;
        return;
      }

      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      writeWrappedText(stripInlineMarkdown(block.text), margin, contentWidth, 5);
      yPosition += 2;
    });

    const fileName = `${note.title || "note"}`
      .replace(/[^\w\s-]/g, "")
      .substring(0, 50);
    doc.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Failed to export note as PDF:", error);
  }
};

const copyShareLink = async (noteId: string, notificationFn: (msg: string) => void) => {
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${baseUrl}/privacy?id=${noteId}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      notificationFn("Share link copied!");
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      notificationFn("Share link copied!");
    }
  } catch (error) {
    console.error("Failed to copy share link:", error);
    throw new Error("Failed to copy share link to clipboard.");
  }
};

export default function NotesPage() {
  const { status: featureStatus, loading: featureLoading } = useFeatureStatus();
  const isAiActive = featureStatus ? featureStatus.ai.active : true;

  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const editorRef = useRef<any>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? notes.filter(
          (n) =>
            (n.title || "").toLowerCase().includes(q) ||
            (n.subject || "").toLowerCase().includes(q) ||
            (n.content || "").toLowerCase().includes(q),
        )
      : notes;
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [notes, query]);

  const loadNotes = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("notes")
        .select("id,title,content,subject,pinned,created_at,updated_at")
        .order("updated_at", { ascending: false });

      if (qErr) {
        setError(qErr.message);
        setNotes([]);
        return;
      }

      const mapped: NoteRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        content: String(r.content ?? ""),
        subject: (r.subject ?? null) as string | null,
        pinned: Boolean(r.pinned),
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
      }));

      setNotes(mapped);
      if (!selectedId && mapped.length) {
        setSelectedId(mapped[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: uErr } = await supabase.auth.getSession();
      if (!alive) return;
      if (uErr) setError(uErr.message);
      if (data.session?.user) await loadNotes();
      else setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setSubject(selected.subject ?? "");
    setContent(selected.content ?? "");
    setPinned(Boolean(selected.pinned));
  }, [selected?.id]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    window.setTimeout(() => setSuccess(null), 1400);
  };

  const createNote = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getSession();
      const user = u.session?.user;
      if (!user) {
        setError("You need to be logged in to create notes.");
        return;
      }

      const nowTitle = "Untitled note";
      const { data, error: insErr } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          title: nowTitle,
          content: "",
          subject: null,
          pinned: false,
        })
        .select("id,title,content,subject,pinned,created_at,updated_at")
        .single();

      if (insErr) {
        setError(insErr.message ?? "Failed to create note.");
        return;
      }

      const created: NoteRow = {
        id: String((data as any).id),
        title: String((data as any).title ?? nowTitle),
        content: String((data as any).content ?? ""),
        subject: ((data as any).subject ?? null) as string | null,
        pinned: Boolean((data as any).pinned),
        created_at: String((data as any).created_at),
        updated_at: String((data as any).updated_at),
      };

      setNotes((ns) => [created, ...ns]);
      setSelectedId(created.id);
      captureEvent(EVENTS.NOTE_CREATED);
      flashSuccess("Note created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create note.");
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    if (!selectedId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || "Untitled note",
        subject: subject.trim() || null,
        content: content ?? "",
        pinned,
      };

      const { data, error: upErr } = await supabase
        .from("notes")
        .update(payload)
        .eq("id", selectedId)
        .select("id,title,content,subject,pinned,created_at,updated_at")
        .single();

      if (upErr) {
        setError(upErr.message ?? "Failed to save note.");
        return;
      }

      const updated: NoteRow = {
        id: String((data as any).id),
        title: String((data as any).title ?? payload.title),
        content: String((data as any).content ?? payload.content),
        subject: ((data as any).subject ?? payload.subject) as string | null,
        pinned: Boolean((data as any).pinned),
        created_at: String((data as any).created_at),
        updated_at: String((data as any).updated_at),
      };

      setNotes((ns) => ns.map((n) => (n.id === selectedId ? updated : n)));
      captureEvent(EVENTS.NOTE_SAVED, { has_subject: !!payload.subject, content_length: payload.content.length, is_pinned: payload.pinned });
      flashSuccess("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async () => {
    if (!selectedId) return;
    setError(null);
    setSuccess(null);
    const id = selectedId;
    const prev = notes;
    const nextNotes = notes.filter((n) => n.id !== id);
    setNotes(nextNotes);
    setSelectedId(nextNotes[0]?.id ?? null);
    setSaving(true);
    try {
      const { error: delErr } = await supabase
        .from("notes")
        .delete()
        .eq("id", id);
      if (delErr) {
        setNotes(prev);
        setSelectedId(id);
        setError(delErr.message);
        return;
      }
      captureEvent(EVENTS.NOTE_DELETED);
      flashSuccess("Deleted.");
    } catch (e) {
      setNotes(prev);
      setSelectedId(id);
      setError(e instanceof Error ? e.message : "Failed to delete note.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDrawing = async (blob: Blob) => {
    try {
      setSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("Not authenticated");

      const fileName = `${user.id}/${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from("notes_images")
        .upload(fileName, blob, { contentType: "image/png" });

      if (error) {
        console.warn("Storage upload failed, falling back to base64", error);
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          if (editorRef.current) {
            editorRef.current.chain().focus().setImage({ src: base64data }).run();
            setContent(editorRef.current.getHTML());
          }
        };
        return;
      }

      const { data: urlData } = supabase.storage
        .from("notes_images")
        .getPublicUrl(fileName);
      
      if (editorRef.current) {
        editorRef.current.chain().focus().setImage({ src: urlData.publicUrl }).run();
        setContent(editorRef.current.getHTML());
      }
      captureEvent(EVENTS.DRAWING_SAVED);
    } catch (err) {
      console.error(err);
      setError("Failed to save drawing.");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (id: string, nextPinned: boolean) => {
    setError(null);
    const prev = notes;
    setNotes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, pinned: nextPinned } : n)),
    );
    try {
      const { error: upErr } = await supabase
        .from("notes")
        .update({ pinned: nextPinned })
        .eq("id", id);
      if (upErr) {
        setNotes(prev);
        setError(upErr.message);
      } else {
        captureEvent(nextPinned ? EVENTS.NOTE_PINNED : EVENTS.NOTE_UNPINNED);
        flashSuccess(nextPinned ? "Pinned." : "Unpinned.");
        await loadNotes();
      }
    } catch (e) {
      setNotes(prev);
      setError(e instanceof Error ? e.message : "Failed to update note.");
    }
  };

  const generateWithAi = async () => {
    if (!selectedId) {
      setAiError("Select or create a note first.");
      return;
    }
    const topic = aiTopic.trim();
    if (!topic) {
      setAiError("Enter a topic to generate notes.");
      return;
    }

    setAiError(null);
    setAiLoading(true);
    setAiTyping(false);
    setContent("Thinking...");
    try {
      const res = await fetch("/api/notes-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const data = (await res.json()) as { notes?: string; error?: string };

      if (!res.ok) {
        const errorMsg = data.error || `HTTP ${res.status}`;
        console.error("[generateWithAi] API error:", errorMsg);
        throw new Error(errorMsg);
      }

      const generated = (data.notes ?? "").trim();
      if (!generated) {
        console.error("[generateWithAi] Empty response from API");
        throw new Error("AI returned empty notes.");
      }

      setAiTyping(true);

      // Convert Markdown to HTML
      const htmlContent = await marked.parse(generated);

      if (editorRef.current) {
        editorRef.current.chain().focus().insertContent(`<br><hr><br><h3>AI Generated Content:</h3>${htmlContent}`).run();
        setContent(editorRef.current.getHTML());
      } else {
        setContent((prev) => prev + `<br><hr><br><h3>AI Generated Content:</h3>${htmlContent}`);
      }

      setAiTyping(false);
      captureEvent(EVENTS.AI_NOTES_GENERATED, { topic_length: topic.length });
      flashSuccess("AI notes appended. Review and save.");
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to generate notes.";
      console.error("[generateWithAi] Error:", errorMsg);
      setAiError(errorMsg);
      setAiTyping(false);
      setContent("");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
            style={{
              background: "rgba(110,231,216,0.08)",
              color: "#6EE7D8",
              border: "1px solid rgba(110,231,216,0.18)",
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Notes
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: "var(--ui-heading)" }}
          >
            Write once. Review fast.
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--ui-muted)" }}>
            Keep clean, revision-ready notes — organised by subject.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={createNote}
            disabled={saving}
            className="btn-primary justify-center text-xs px-4 py-2.5"
            style={{ opacity: saving ? 0.8 : 1 }}
          >
            + New note
          </button>
          <button
            type="button"
            onClick={saveNote}
            disabled={saving || !selectedId}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{
              background: selectedId
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.03)",
              border: "1px solid var(--ui-border)",
              color: selectedId ? "var(--ui-text)" : "var(--ui-subtle)",
              cursor: selectedId ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={deleteNote}
            disabled={saving || !selectedId}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.22)",
              color: selectedId ? "#b91c1c" : "var(--ui-subtle)",
              opacity: selectedId ? 1 : 0.6,
              cursor: selectedId ? "pointer" : "not-allowed",
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => { if (selected) { captureEvent(EVENTS.NOTE_EXPORTED_PDF); exportNoteToPdf(selected); } }}
            disabled={!selectedId}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{
              background: selectedId
                ? "rgba(110,231,216,0.08)"
                : "rgba(110,231,216,0.04)",
              border: selectedId
                ? "1px solid rgba(110,231,216,0.22)"
                : "1px solid rgba(110,231,216,0.12)",
              color: selectedId ? "#6EE7D8" : "var(--ui-subtle)",
              cursor: selectedId ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (selectedId) {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.35)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(110,231,216,0.12)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedId) {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.22)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(110,231,216,0.08)";
              }
            }}
          >
            📄 Export PDF
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedId) {
                captureEvent(EVENTS.NOTE_SHARE_LINK_COPIED);
                copyShareLink(selectedId, flashSuccess).catch((e) => {
                  const msg = e instanceof Error ? e.message : "Failed to copy link.";
                  setError(msg);
                });
              }
            }}
            disabled={!selectedId}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150"
            style={{
              background: selectedId
                ? "rgba(110,231,216,0.08)"
                : "rgba(110,231,216,0.04)",
              border: selectedId
                ? "1px solid rgba(110,231,216,0.22)"
                : "1px solid rgba(110,231,216,0.12)",
              color: selectedId ? "#6EE7D8" : "var(--ui-subtle)",
              cursor: selectedId ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (selectedId) {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.35)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(110,231,216,0.12)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedId) {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.22)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(110,231,216,0.08)";
              }
            }}
          >
            🔗 Share
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Your Notes</SectionLabel>
            <button
              type="button"
              onClick={loadNotes}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: "var(--ui-surface-2)",
                border: "1px solid var(--ui-border)",
                color: "var(--ui-text)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(110,231,216,0.12)";
              }}
            >
              Refresh
            </button>
          </div>

          {(error || success) && (
            <div className="space-y-2 mb-4">
              {error && (
                <div
                  className="rounded-xl px-3 py-2 text-sm"
                  role="alert"
                  style={{
                    background: "rgba(248,113,113,0.10)",
                    border: "1px solid rgba(248,113,113,0.22)",
                    color: "#b91c1c",
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="rounded-xl px-3 py-2 text-sm"
                  role="status"
                  style={{
                    background: "rgba(110,231,216,0.10)",
                    border: "1px solid rgba(110,231,216,0.22)",
                    color: "var(--ui-heading)",
                  }}
                >
                  {success}
                </div>
              )}
            </div>
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="rounded-xl px-3 py-2.5 text-sm w-full mb-4"
            style={{
              background: "var(--ui-surface)",
              border: "1px solid rgba(110,231,216,0.15)",
              color: "var(--ui-heading)",
              outline: "none",
            }}
          />

          <div className="space-y-2.5">
            {loading && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: "var(--ui-surface-2)",
                  border: "1px solid var(--ui-border)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
                  Loading your notes…
                </p>
              </div>
            )}

            {!loading && filtered.length === 0 && !error && (
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(110,231,216,0.05)",
                  border: "1px dashed rgba(110,231,216,0.18)",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--ui-heading)" }}
                >
                  No notes yet.
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--ui-muted)" }}
                >
                  Create your first note — keep it structured and concise.
                </p>
              </div>
            )}

            {!loading &&
              filtered.map((n) => {
                const active = n.id === selectedId;
                return (
                  <div
                    key={n.id}
                    className="group p-3.5 rounded-xl cursor-pointer transition-all duration-150"
                    style={{
                      background: active
                        ? "rgba(110,231,216,0.10)"
                        : "rgba(255,255,255,0.03)",
                      border: active
                        ? "1px solid rgba(110,231,216,0.28)"
                        : "1px solid rgba(110,231,216,0.08)",
                      boxShadow: active
                        ? "0 0 12px rgba(110,231,216,0.08)"
                        : "none",
                    }}
                    onClick={() => setSelectedId(n.id)}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "rgba(110,231,216,0.22)";
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "rgba(110,231,216,0.08)";
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.03)";
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          togglePin(n.id, !n.pinned);
                        }}
                        className="mt-0.5 p-1.5 rounded-lg transition-colors duration-150"
                        title={n.pinned ? "Unpin" : "Pin"}
                        style={{
                          color: n.pinned ? "#fbbf24" : "var(--ui-subtle)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "#fbbf24";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            n.pinned ? "#fbbf24" : "var(--ui-subtle)";
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M16 3l5 5-6.5 6.5v5.5l-3-2-3 2v-5.5L3 8l5-5h8z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          exportNoteToPdf(n);
                        }}
                        className="mt-0.5 p-1.5 rounded-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                        title="Export as PDF"
                        style={{
                          color: "var(--ui-subtle)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "#6EE7D8";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "var(--ui-subtle)";
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          copyShareLink(n.id, flashSuccess).catch((e) => {
                            const msg =
                              e instanceof Error
                                ? e.message
                                : "Failed to copy link.";
                            setError(msg);
                          });
                        }}
                        className="mt-0.5 p-1.5 rounded-lg transition-colors duration-150 opacity-0 group-hover:opacity-100"
                        title="Share note"
                        style={{
                          color: "var(--ui-subtle)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "#6EE7D8";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "var(--ui-subtle)";
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "var(--ui-heading)" }}
                        >
                          {n.title || "Untitled note"}
                        </p>
                        <p
                          className="text-[11px] mt-0.5 truncate"
                          style={{ color: "var(--ui-muted)" }}
                        >
                          {n.subject ?? "General"} • updated {fmt(n.updated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        <Card className="lg:col-span-2 flex flex-col gap-4">
          <SectionLabel>Editor</SectionLabel>

          {!selectedId && !loading ? (
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(110,231,216,0.05)",
                border: "1px dashed rgba(110,231,216,0.18)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--ui-heading)" }}
              >
                Select a note to edit.
              </p>
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--ui-muted)" }}
              >
                Or create a new note to start writing.
              </p>
            </div>
          ) : (
            <>
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: "rgba(110,231,216,0.04)",
                  border: "1px solid rgba(110,231,216,0.14)",
                  opacity: isAiActive ? 1 : 0.65,
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    AI Notes Generator
                  </p>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--ui-muted)" }}
                  >
                    Auto-fills this editor
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={aiTopic}
                    onChange={(e) => {
                      setAiTopic(e.target.value);
                      if (aiError) setAiError(null);
                    }}
                    placeholder={isAiActive ? "Enter topic (e.g. Electromagnetic Induction)" : "AI generation is disabled (missing key)"}
                    className="rounded-xl px-3 py-2.5 text-sm w-full"
                    style={{
                      background: "var(--ui-surface)",
                      border: isAiActive ? "1px solid rgba(110,231,216,0.15)" : "1px solid rgba(248,113,113,0.20)",
                      color: isAiActive ? "var(--ui-heading)" : "var(--ui-muted)",
                      outline: "none",
                      cursor: isAiActive ? "text" : "not-allowed",
                    }}
                    disabled={!selectedId || aiLoading || aiTyping || !isAiActive}
                  />
                  <button
                    type="button"
                    onClick={generateWithAi}
                    disabled={!selectedId || aiLoading || aiTyping || !aiTopic.trim() || !isAiActive}
                    className="btn-primary justify-center text-xs px-4 py-2.5 whitespace-nowrap"
                    style={{
                      opacity:
                        !selectedId || aiLoading || aiTyping || !aiTopic.trim() || !isAiActive
                          ? 0.5
                          : 1,
                      cursor:
                        !selectedId || aiLoading || aiTyping || !aiTopic.trim() || !isAiActive
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {aiLoading
                      ? "Thinking..."
                      : aiTyping
                        ? "Writing notes..."
                        : "Generate with AI"}
                  </button>
                </div>
                {!featureLoading && !isAiActive && (
                  <p className="text-xs text-amber-500 font-medium mt-1">
                    ⚠️ Disabled (Missing <code className="font-mono text-[10px] px-1 rounded bg-amber-500/10">GEMINI_API_KEY</code> in environment variables)
                  </p>
                )}
                {aiLoading && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{
                      background: "rgba(110,231,216,0.06)",
                      border: "1px solid rgba(110,231,216,0.16)",
                    }}
                  >
                    <p className="text-xs font-semibold" style={{ color: "#0f766e" }}>
                      Thinking...
                    </p>
                    {["100%", "88%", "72%"].map((width) => (
                      <div
                        key={width}
                        className="h-2.5 rounded-lg animate-pulse"
                        style={{ width, background: "rgba(110,231,216,0.18)" }}
                      />
                    ))}
                  </div>
                )}
                {aiTyping && (
                  <p className="text-[11px]" style={{ color: "var(--ui-muted)" }}>
                    Writing the generated notes into your editor...
                  </p>
                )}
                {aiError && (
                  <div
                    className="rounded-xl px-3 py-2 text-sm"
                    role="alert"
                    style={{
                      background: "rgba(248,113,113,0.10)",
                      border: "1px solid rgba(248,113,113,0.22)",
                      color: "#b91c1c",
                    }}
                  >
                    {aiError}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--ui-heading)" }}
                  >
                    Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Chapter 4 — Thermodynamics"
                    className="rounded-xl px-3 py-2.5 text-sm w-full"
                    style={{
                      background: "var(--ui-surface)",
                      border: "1px solid rgba(110,231,216,0.15)",
                      color: "var(--ui-heading)",
                      outline: "none",
                    }}
                    disabled={!selectedId}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--ui-heading)" }}
                  >
                    Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Physics"
                    className="rounded-xl px-3 py-2.5 text-sm w-full"
                    style={{
                      background: "var(--ui-surface)",
                      border: "1px solid rgba(110,231,216,0.15)",
                      color: "var(--ui-heading)",
                      outline: "none",
                    }}
                    disabled={!selectedId}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPinned((p) => !p)}
                  disabled={!selectedId}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: pinned
                      ? "rgba(245,158,11,0.12)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${pinned ? "rgba(245,158,11,0.35)" : "rgba(110,231,216,0.12)"}`,
                    color: pinned ? "#fbbf24" : "rgba(255,255,255,0.55)",
                    cursor: selectedId ? "pointer" : "not-allowed",
                  }}
                >
                  {pinned ? "Pinned" : "Pin"}
                </button>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--ui-muted)" }}
                >
                  {selected ? `Last updated ${fmt(selected.updated_at)}` : " "}
                </span>
              </div>

              <div className="flex-1 flex flex-col">
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--ui-heading)" }}
                >
                  Content
                </label>
                <div className="flex-1 mt-1 mb-4" style={{ minHeight: "400px" }}>
                  <RichTextEditor
                    key={selectedId}
                    content={content}
                    onChange={setContent}
                    onOpenDrawing={() => { captureEvent(EVENTS.DRAWING_CANVAS_OPENED); setIsDrawingOpen(true); }}
                    editorRef={editorRef}
                  />
                </div>
                {aiTyping && (
                  <p className="mt-2 text-[11px] animate-pulse" style={{ color: "#0f766e" }}>
                    AI is writing...
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {isDrawingOpen && (
        <DrawingCanvas 
          onClose={() => setIsDrawingOpen(false)}
          onSave={handleSaveDrawing}
        />
      )}
    </div>
  );
}
