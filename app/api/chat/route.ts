import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase-config";
import { runChatCompletion } from "@/lib/ai/agents/shared";


export async function POST(req: NextRequest) {
  try {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

    let response = NextResponse.next();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            req.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, userMessage } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    if (!userMessage || !userMessage.trim()) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    // Verify session exists and belongs to the current user
    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError) {
      if (sessionError.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "Database tables for chatbot history are missing. Please run the SQL migrations in the Supabase SQL editor to create the 'chat_sessions' and 'chat_messages' tables.",
          },
          { status: 501 },
        );
      }
      return NextResponse.json(
        { error: "Chat session not found or access denied" },
        { status: 404 },
      );
    }

    // Insert user message to Supabase
    const { error: userMsgError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role: "user",
        content: userMessage.trim(),
      });

    if (userMsgError) {
      return NextResponse.json(
        { error: "Failed to save user message" },
        { status: 500 },
      );
    }

    // Fetch message history for the session (last 20 messages for context)
    const { data: rawHistory, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (historyError || !rawHistory) {
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 },
      );
    }

    // Cast data safely
    const messages = rawHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemPrompt = `You are EduFlow AI's Chatbot assistant.
You are a friendly, intelligent, and general-purpose conversational assistant similar to ChatGPT.
You support general queries on any topic (writing code, planning, explaining, emails, creative projects, etc.) as well as studies.
You are an open assistant, meaning you do not refuse general queries.
Always structure your answers cleanly. Use Markdown: #/## headings, - bullets, **bold** key terms, \`code\` blocks or inline code, and tables when presenting compared data.
Keep your tone polite, engaging, and professional.`;

    let aiAnswer: string;
    try {
      aiAnswer = await runChatCompletion({
        systemPrompt,
        messages,
        temperature: 0.5,
        maxTokens: 1500,
      });
    } catch (apiError) {
      const errorMsg =
        apiError instanceof Error
          ? apiError.message
          : "AI completion request failed.";
      return NextResponse.json(
        { error: `AI request failed: ${errorMsg}` },
        { status: 502 },
      );
    }

    // Save assistant message to Supabase
    const { error: aiMsgError } = await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: aiAnswer,
    });

    if (aiMsgError) {
      return NextResponse.json(
        { error: "Failed to save AI response" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      answer: aiAnswer,
      success: true,
    });
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unexpected server error.";
    console.error("[chat-api] Unexpected error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
