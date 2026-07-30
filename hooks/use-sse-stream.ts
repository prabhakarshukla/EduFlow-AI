"use client";

import { useCallback, useRef, useState } from "react";

export interface UseSseStreamProps {
  endpoint: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export interface UseSseStreamReturn {
  startStream: (body: unknown) => Promise<void>;
  stopStream: () => void;
  isStreaming: boolean;
  error: string | null;
}

export function useSseStream({
  endpoint,
  onChunk,
  onComplete,
  onError,
}: UseSseStreamProps): UseSseStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef("");

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    async (body: unknown) => {
      setIsStreaming(true);
      setError(null);
      fullTextRef.current = "";

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6).trim();
            if (data === "[DONE]") continue;

            // Check for error object
            if (data.startsWith("{")) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  setError(parsed.error);
                  onError?.(parsed.error);
                  continue;
                }
              } catch {
                // Not a JSON error, treat as plain text
              }
            }

            if (data) {
              fullTextRef.current += data;
              onChunk?.(data);
            }
          }
        }

        onComplete?.(fullTextRef.current);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stream error";
        if (message.includes("abort") || message.includes("Abort")) {
          // User cancelled, don't set error
          return;
        }
        setError(message);
        onError?.(message);
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [endpoint, onChunk, onComplete, onError],
  );

  return { startStream, stopStream, isStreaming, error };
}
