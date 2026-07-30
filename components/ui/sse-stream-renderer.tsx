"use client";

import { memo } from "react";

interface SseStreamRendererProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export const SseStreamRenderer = memo(function SseStreamRenderer({
  content,
  isStreaming,
  className = "",
}: SseStreamRendererProps) {
  // Convert basic Markdown to HTML for display
  const formatContent = (text: string) => {
    return text
      .replace(/#{2} (.*?)\n/g, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
      .replace(/#{1} (.*?)\n/g, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/- (.*?)\n/g, '<li class="ml-4">$1</li>')
      .replace(/\n/g, "<br/>");
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className="prose prose-sm max-w-none"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: formatContent(content),
        }}
      />
      {isStreaming && (
        <span className="inline-block w-2 h-5 bg-teal-400 ml-1 animate-pulse rounded-sm" />
      )}
    </div>
  );
});
