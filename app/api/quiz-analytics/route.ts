import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // Get access token from Authorization header
    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch only this user's quiz attempts
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const totalQuizzes = data.length;

    const averageScore =
      totalQuizzes > 0
        ? data.reduce(
            (sum, item) => sum + item.percentage,
            0
          ) / totalQuizzes
        : 0;

    const bestScore =
      totalQuizzes > 0
        ? Math.max(...data.map((item) => item.percentage))
        : 0;

    const totalQuestions = data.reduce(
      (sum, item) => sum + item.total_questions,
      0
    );

    return NextResponse.json({
      cards: {
        totalQuizzes,
        averageScore,
        bestScore,
        totalQuestions,
      },
      attempts: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}