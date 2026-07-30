"use client";

import { useState } from "react";
import { performBulkExport, downloadFile, ExportItem } from "@/utils/bulk-export";
import { supabase } from "@/lib/supabase";

interface BulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: ExportItem[];
}

export function BulkExportModal({ isOpen, onClose, notes }: BulkExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "markdown" | "txt">("pdf");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map((n) => n.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleNote = (id: string) => {
    const newIds = new Set(selectedIds);
    if (newIds.has(id)) {
      newIds.delete(id);
    } else {
      newIds.add(id);
    }
    setSelectedIds(newIds);
    setSelectAll(newIds.size === notes.length);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      setError("Please select at least one note to export.");
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      const itemsToExport = notes.filter((n) => selectedIds.has(n.id));
      const result = await performBulkExport({
        format: selectedFormat,
        items: itemsToExport,
      });
      downloadFile(result.blob, result.filename);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--ui-heading)" }}>
          Bulk Export Notes
        </h2>

        {error && (
          <div
            className="rounded-xl px-3 py-2 text-sm mb-4"
            style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.22)", color: "#b91c1c" }}
          >
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-semibold mb-2" style={{ color: "var(--ui-muted)" }}>
            Export Format
          </label>
          <div className="flex gap-2">
            {(["pdf", "markdown", "txt"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setSelectedFormat(format)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: selectedFormat === format ? "rgba(110,231,216,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedFormat === format ? "rgba(110,231,216,0.35)" : "var(--ui-border)"}`,
                  color: selectedFormat === format ? "#6EE7D8" : "var(--ui-text)",
                }}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-medium mb-2"
            style={{ color: "var(--ui-muted)" }}
          >
            {selectAll ? "Deselect All" : "Select All"} ({selectedIds.size} selected)
          </button>
        </div>

        <div className="space-y-1.5 max-h-60 overflow-y-auto mb-4 pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => toggleNote(note.id)}
              className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(110,231,216,0.06)" }}
            >
              <div
                className="w-4 h-4 rounded border flex items-center justify-center"
                style={{
                  borderColor: selectedIds.has(note.id) ? "#6EE7D8" : "var(--ui-border)",
                  background: selectedIds.has(note.id) ? "rgba(110,231,216,0.2)" : "transparent",
                }}
              >
                {selectedIds.has(note.id) && <span style={{ color: "#6EE7D8" }}>✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--ui-heading)" }}>
                  {note.title || "Untitled Note"}
                </p>
                <p className="text-[11px]" style={{ color: "var(--ui-muted)" }}>
                  {note.subject || "General"}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--ui-border)", color: "var(--ui-text)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || selectedIds.size === 0}
            className="btn-primary px-4 py-2 rounded-xl text-xs font-medium"
            style={{ opacity: isExporting || selectedIds.size === 0 ? 0.5 : 1 }}
          >
            {isExporting ? "Exporting..." : `Export ${selectedIds.size} Notes`}
          </button>
        </div>
      </div>
    </div>
  );
}
