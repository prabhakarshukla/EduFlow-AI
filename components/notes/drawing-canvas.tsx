"use client";

import React, { useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { X, Save, Undo, Redo, Trash, Eraser, Pen } from "lucide-react";

interface DrawingCanvasProps {
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

export function DrawingCanvas({ onSave, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeColor, setStrokeColor] = useState("#14B8A6");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    try {
      const dataUri = await canvasRef.current.exportImage("png");
      
      // Convert Data URI to Blob
      const res = await fetch(dataUri);
      const blob = await res.blob();
      
      await onSave(blob);
      onClose();
    } catch (e) {
      console.error("Failed to save drawing:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
      <div 
        className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--ui-border)", background: "var(--ui-bg)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ui-heading)" }}>Drawing Canvas</h2>
          <div className="flex items-center gap-3 overflow-x-auto">
            <button
              onClick={() => { setIsEraser(false); canvasRef.current?.eraseMode(false); }}
              className={`p-2 flex-shrink-0 rounded-lg transition-colors ${!isEraser ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:bg-gray-800'}`}
              title="Pen"
            >
              <Pen size={18} />
            </button>
            <button
              onClick={() => { setIsEraser(true); canvasRef.current?.eraseMode(true); }}
              className={`p-2 flex-shrink-0 rounded-lg transition-colors ${isEraser ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:bg-gray-800'}`}
              title="Eraser"
            >
              <Eraser size={18} />
            </button>
            <div className="h-6 w-px bg-gray-700 mx-1 flex-shrink-0" />
            <input 
              type="color" 
              value={strokeColor} 
              onChange={(e) => { setStrokeColor(e.target.value); setIsEraser(false); canvasRef.current?.eraseMode(false); }}
              className="w-8 h-8 flex-shrink-0 rounded cursor-pointer border-0 p-0 bg-transparent"
              title="Stroke Color"
            />
            <input 
              type="range" 
              min="1" max="20" 
              value={strokeWidth} 
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-24 flex-shrink-0 accent-teal-500"
              title="Stroke Width"
            />
            <div className="h-6 w-px bg-gray-700 mx-1 flex-shrink-0" />
            <button onClick={() => canvasRef.current?.undo()} className="p-2 flex-shrink-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg" title="Undo"><Undo size={18} /></button>
            <button onClick={() => canvasRef.current?.redo()} className="p-2 flex-shrink-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg" title="Redo"><Redo size={18} /></button>
            <button onClick={() => canvasRef.current?.clearCanvas()} className="p-2 flex-shrink-0 text-red-400 hover:bg-red-500/20 rounded-lg" title="Clear Canvas"><Trash size={18} /></button>
            <div className="h-6 w-px bg-gray-700 mx-1 flex-shrink-0" />
            <button onClick={onClose} className="p-2 flex-shrink-0 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg" title="Close"><X size={18} /></button>
          </div>
        </div>
        
        <div className="flex-1 bg-white relative cursor-crosshair">
          <ReactSketchCanvas
            ref={canvasRef}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            eraserWidth={strokeWidth * 2}
            canvasColor="#ffffff"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>

        <div className="p-4 flex justify-end" style={{ borderTop: "1px solid var(--ui-border)", background: "var(--ui-bg)" }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: saving ? "rgba(110,231,216,0.35)" : "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
              color: "#0d2420",
              boxShadow: saving ? "none" : "0 4px 16px rgba(110,231,216,0.30)",
            }}
          >
            {saving ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                <Save size={18} />
                Insert into Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
