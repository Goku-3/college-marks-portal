import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("student_id");

    if (!studentId) {
      return NextResponse.json(
        { error: "student_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("marks")
      .select("*")
      .eq("student_id", studentId);

    if (error) {
      console.error("Student marks query failed:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      marks: data ?? [],
    });
  } catch (error) {
    console.error("Student marks API error:", error);

    return NextResponse.json(
      { error: "Failed to load student marks" },
      { status: 500 }
    );
  }
}