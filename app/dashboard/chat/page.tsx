"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { captureEvent } from "@/lib/posthog/helpers";
import { EVENTS } from "@/lib/posthog/events";
import { FormattedNote } from "@/components/notes/formatted-note";

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const starterPrompts = [
  {
    title: "Write code",
    prompt: "Write a JavaScript function to sort an array of objects by a specific property.",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  },
  {
    title: "Explain databases",
    prompt: "What is the difference between SQL and NoSQL databases? Provide use cases for both.",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
  },
  {
    title: "Draft email",
    prompt: "Draft a polite email to my professor requesting a 2-day extension on my assignment.",
    icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  },
  {
    title: "Brainstorm ideas",
    prompt: "Help me brainstorm 5 unique web application ideas for a computer science portfolio project.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
];

export default function ChatbotPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sidebar state
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Renaming state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Table status detection
  const [setupRequired, setSetupRequired] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  // Load chat sessions from Supabase
  const loadSessions = async () => {
    try {
      setError(null);
      setSetupRequired(false);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const { data, error: qErr } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (qErr) {
        if (qErr.code === "42P01") {
          setSetupRequired(true);
        } else {
          setError(qErr.message);
        }
        return;
      }

      setSessions(data || []);
      
      // Auto select first session if none selected
      if (data && data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat history.");
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (data.user) {
        await loadSessions();
      } else {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Fetch messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const { data, error: qErr } = await supabase
          .from("chat_messages")
          .select("id, session_id, role, content, created_at")
          .eq("session_id", activeSessionId)
          .order("created_at", { ascending: true });

        if (qErr) {
          setError(qErr.message);
          return;
        }

        setMessages(data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load messages.");
      }
    };

    fetchMessages();
  }, [activeSessionId]);

  // Create a new chat session
  const startNewChat = async () => {
    try {
      setError(null);
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;

      const title = "General Conversation";
      const { data, error: insErr } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title,
        })
        .select()
        .single();

      if (insErr) {
        setError(insErr.message);
        return;
      }

      captureEvent(EVENTS.CHAT_SESSION_CREATED);
      setSessions((prev) => [data, ...prev]);
      setActiveSessionId(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create new chat.");
    }
  };

  // Delete chat session
  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session?")) return;

    try {
      const { error: delErr } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", id);

      if (delErr) {
        setError(delErr.message);
        return;
      }

      captureEvent(EVENTS.CHAT_SESSION_DELETED);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete chat.");
    }
  };

  // Start editing chat session title
  const startEditingTitle = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleValue(session.title);
  };

  // Save renamed session title
  const saveSessionTitle = async (id: string) => {
    const trimmedTitle = editTitleValue.trim();
    if (!trimmedTitle) {
      setEditingSessionId(null);
      return;
    }

    try {
      const { error: upErr } = await supabase
        .from("chat_sessions")
        .update({ title: trimmedTitle })
        .eq("id", id);

      if (upErr) {
        setError(upErr.message);
        return;
      }

      captureEvent(EVENTS.CHAT_SESSION_RENAMED);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: trimmedTitle } : s))
      );
      setEditingSessionId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename chat.");
    }
  };

  // Send message
  const sendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText) return;

    let currentSessionId = activeSessionId;

    // If no active session, create one first
    if (!currentSessionId) {
      try {
        setSending(true);
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;

        // Use first few words of message as title
        const firstWords = messageText.split(" ").slice(0, 4).join(" ");
        const title = firstWords.length > 30 ? firstWords.slice(0, 30) + "..." : firstWords || "General Conversation";
        
        const { data, error: insErr } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: u.user.id,
            title,
          })
          .select()
          .single();

        if (insErr) {
          setError(insErr.message);
          setSending(false);
          return;
        }

        setSessions((prev) => [data, ...prev]);
        setActiveSessionId(data.id);
        currentSessionId = data.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start new chat session.");
        setSending(false);
        return;
      }
    }

    // Set input values
    if (!textToSend) setInput("");
    setSending(true);
    setError(null);

    if (!currentSessionId) {
      setSending(false);
      return;
    }

    // Optimistically update UI
    const optimisticUserMsg: ChatMessage = {
      id: Math.random().toString(),
      session_id: currentSessionId,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          userMessage: messageText,
        }),
      });

      const data = (await res.json()) as { answer?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Failed to process chat response.");
      }

      captureEvent(EVENTS.CHAT_MESSAGE_SENT);
      if (data.answer) {
        const aiMsg: ChatMessage = {
          id: Math.random().toString(),
          session_id: currentSessionId,
          role: "assistant",
          content: data.answer,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        // If the title of the session was "General Conversation", auto-rename it based on the first prompt
        const currentSession = sessions.find((s) => s.id === currentSessionId);
        if (currentSession && currentSession.title === "General Conversation") {
          const firstWords = messageText.split(" ").slice(0, 4).join(" ");
          const cleanTitle = firstWords.length > 25 ? firstWords.slice(0, 25) + "..." : firstWords || "General Conversation";
          
          await supabase
            .from("chat_sessions")
            .update({ title: cleanTitle })
            .eq("id", currentSessionId);

          setSessions((prev) =>
            prev.map((s) => (s.id === currentSessionId ? { ...s, title: cleanTitle } : s))
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI chatbot request failed.");
      // Rollback optimistic message if error happens early
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Setup Required SQL Guidance View
  if (setupRequired) {
    return (
      <div className="px-6 py-12 max-w-2xl mx-auto space-y-6">
        <div
          className="rounded-2xl p-6 md:p-8 space-y-6 text-center"
          style={{ background: "var(--ui-surface)", border: "1px solid var(--ui-border)" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 mx-auto animate-pulse">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold" style={{ color: "var(--ui-heading)" }}>
              Supabase Tables Required
            </h1>
            <p className="text-sm" style={{ color: "var(--ui-muted)" }}>
              The AI Chatbot relies on Supabase database history. Run the following SQL migration script in your Supabase project's SQL Editor to set up the chat tables.
            </p>
          </div>

          <div className="text-left bg-black/15 dark:bg-black/40 rounded-xl p-4 overflow-hidden border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-muted uppercase tracking-wider">SQL migration script</span>
            </div>
            <pre className="text-[10px] font-mono p-3 bg-black/10 rounded-lg overflow-y-auto text-text max-h-64 whitespace-pre-wrap select-all leading-normal" style={{ color: "var(--ui-text)" }}>
{`CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can create their own chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chat sessions" ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);`}
            </pre>
          </div>

          <button
            onClick={loadSessions}
            className="btn-primary w-full py-3 mt-4 text-sm font-semibold rounded-xl transition-all duration-200"
          >
            I have executed the SQL. Try loading again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] relative overflow-hidden">
      
      {/* Sidebar Drawer on Mobile Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - Chat History */}
      <aside
        className={`
          absolute md:static inset-y-0 left-0 z-40 flex flex-col w-64 md:w-72 flex-shrink-0 border-r transition-transform duration-300 ease-in-out
          ${showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:flex"}
        `}
        style={{
          background: "var(--ui-surface)",
          borderRightColor: "var(--ui-border)",
          height: "100%",
        }}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b flex-shrink-0 flex items-center justify-between" style={{ borderBottomColor: "var(--ui-border)" }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--ui-muted)" }}>
            Chat History
          </span>
          <button
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200"
            style={{
              background: "rgba(110,231,216,0.08)",
              border: "1px solid rgba(110,231,216,0.18)",
              color: "#14B8A6",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(110,231,216,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(110,231,216,0.08)";
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
          {loading ? (
            <div className="p-4 text-center text-xs" style={{ color: "var(--ui-muted)" }}>
              Loading chats...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-xs space-y-2 border border-dashed rounded-xl" style={{ borderColor: "var(--ui-border)", background: "rgba(110,231,216,0.02)" }}>
              <p style={{ color: "var(--ui-muted)" }}>No chat history found.</p>
              <button
                onClick={startNewChat}
                className="text-[11px] font-semibold underline"
                style={{ color: "#14B8A6" }}
              >
                Start your first chat
              </button>
            </div>
          ) : (
            sessions.map((s) => {
              const active = s.id === activeSessionId;
              const isEditing = s.id === editingSessionId;

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (!isEditing) {
                      setActiveSessionId(s.id);
                      // Close sidebar on mobile after selection
                      if (window.innerWidth < 768) {
                        setShowSidebar(false);
                      }
                    }
                  }}
                  className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                    active ? "bg-teal-500/5 text-teal-500 border border-teal-500/10" : "hover:bg-gray-100 dark:hover:bg-slate-800 text-text"
                  }`}
                  style={{
                    background: active ? "var(--ui-active-bg)" : "transparent",
                    color: active ? "#14B8A6" : "var(--ui-text)",
                    border: active ? "1px solid rgba(20, 184, 166, 0.15)" : "1px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: active ? "#14B8A6" : "var(--ui-muted)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    
                    {isEditing ? (
                      <input
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => saveSessionTitle(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveSessionTitle(s.id);
                          if (e.key === "Escape") setEditingSessionId(null);
                        }}
                        autoFocus
                        className="bg-transparent border-b border-teal-500/30 text-xs py-0.5 outline-none w-full"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-xs font-medium truncate pr-4 leading-normal">
                        {s.title}
                      </span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-150 absolute right-2 bg-gradient-to-l from-white via-white dark:from-slate-900 pl-4">
                      <button
                        onClick={(e) => startEditingTitle(s, e)}
                        title="Rename Chat"
                        className="p-1 rounded text-muted hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                        style={{ color: "var(--ui-muted)" }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteSession(s.id, e)}
                        title="Delete Chat"
                        className="p-1 rounded text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        style={{ color: "var(--ui-muted)" }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Container */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full" style={{ background: "var(--ui-bg)" }}>
        {/* Chat Header */}
        <header className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderBottomColor: "var(--ui-border)", background: "var(--ui-surface)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg border transition-colors md:hidden"
              style={{ borderColor: "var(--ui-border)", color: "var(--ui-muted)" }}
              aria-label="Toggle history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate leading-tight" style={{ color: "var(--ui-heading)" }}>
                {activeSession ? activeSession.title : "New AI Chat"}
              </h2>
              <p className="text-[10px]" style={{ color: "var(--ui-muted)" }}>
                Powered by Gemini AI / OpenRouter
              </p>
            </div>
          </div>
        </header>

        {/* Error notifications */}
        {error && (
          <div className="px-5 py-2.5 flex items-start gap-3 border-b bg-red-500/5 border-red-500/10 flex-shrink-0">
            <svg className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-thin">
          {messages.length === 0 && !sending ? (
            /* Starter Onboarding Screen */
            <div className="max-w-2xl mx-auto py-10 space-y-8">
              <div className="text-center space-y-2.5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                  style={{
                    background: "rgba(110,231,216,0.08)",
                    border: "1px solid rgba(110,231,216,0.18)",
                  }}
                >
                  <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--ui-heading)" }}>
                  How can I help you today?
                </h1>
                <p className="text-xs max-w-md mx-auto leading-relaxed" style={{ color: "var(--ui-muted)" }}>
                  Feel free to ask academic doubt explanation, code scripts writing, planning layout or general assistant conversations.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {starterPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(item.prompt)}
                    className="text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 space-y-2 group"
                    style={{
                      background: "var(--ui-surface)",
                      borderColor: "var(--ui-border)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(110,231,216,0.3)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(110,231,216,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--ui-border)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/5 flex items-center justify-center text-teal-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                      </div>
                      <span className="text-xs font-bold" style={{ color: "var(--ui-heading)" }}>
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted line-clamp-2" style={{ color: "var(--ui-muted)" }}>
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Dialogue turns */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}>
                    
                    {/* Assistant Avatar */}
                    {!isUser && (
                      <div
                        className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border font-bold text-[10px]"
                        style={{
                          background: "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                          color: "#0d2420",
                          borderColor: "rgba(110,231,216,0.2)",
                        }}
                      >
                        AI
                      </div>
                    )}

                    {/* Message content box */}
                    <div
                      className={`rounded-2xl p-4 max-w-[85%] text-sm shadow-sm transition-all duration-200 border ${
                        isUser
                          ? "bg-teal-500/5 text-teal-600 dark:text-teal-400 border-teal-500/10"
                          : "border-border"
                      }`}
                      style={{
                        background: isUser ? "rgba(110,231,216,0.06)" : "var(--ui-surface)",
                        borderColor: isUser ? "rgba(110,231,216,0.14)" : "var(--ui-border)",
                        color: isUser ? "var(--ui-text)" : "var(--ui-text)",
                      }}
                    >
                      <FormattedNote content={msg.content} emptyText="" />
                    </div>

                    {/* User Avatar Letter */}
                    {isUser && (
                      <div
                        className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-white"
                        style={{
                          background: "var(--ui-surface-2)",
                          border: "1px solid var(--ui-border)",
                          color: "var(--ui-text)"
                        }}
                      >
                        U
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing Indicator loading state */}
              {sending && (
                <div className="flex gap-3.5 justify-start">
                  <div
                    className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border font-bold text-[10px]"
                    style={{
                      background: "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)",
                      color: "#0d2420",
                      borderColor: "rgba(110,231,216,0.2)",
                    }}
                  >
                    AI
                  </div>

                  <div
                    className="rounded-2xl p-4 max-w-[85%] text-sm border flex items-center gap-1.5"
                    style={{
                      background: "var(--ui-surface)",
                      borderColor: "var(--ui-border)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form Area */}
        <footer className="p-4 border-t flex-shrink-0" style={{ borderTopColor: "var(--ui-border)", background: "var(--ui-surface)" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="max-w-3xl mx-auto flex items-end gap-2.5 rounded-2xl p-2 border"
            style={{
              borderColor: "var(--ui-border)",
              background: "var(--ui-bg)",
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message EduFlow AI..."
              className="flex-1 max-h-32 min-h-[40px] px-3 py-2 bg-transparent outline-none resize-none text-sm leading-relaxed"
              style={{ color: "var(--ui-heading)" }}
            />
            
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
              style={{
                background: input.trim() && !sending ? "linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)" : "rgba(255,255,255,0.05)",
                color: input.trim() && !sending ? "#0d2420" : "var(--ui-subtle)",
                cursor: input.trim() && !sending ? "pointer" : "not-allowed",
              }}
            >
              <svg className="w-5 h-5 transform rotate-45 -translate-x-0.5 translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
          <div className="max-w-3xl mx-auto text-center mt-2">
            <span className="text-[9px]" style={{ color: "var(--ui-muted)" }}>
              AI can make mistakes. Consider checking important information.
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
