import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const studentId =
      request.nextUrl.searchParams.get("student_id")?.trim();

    if (!studentId) {
      return NextResponse.json(
        {
          success: false,
          error: "student_id is required",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    /*
     * First verify that the student exists.
     */
    const {
      data: student,
      error: studentError,
    } = await supabase
      .from("students")
      .select("id, student_id, name")
      .eq("id", studentId)
      .maybeSingle();

    if (studentError) {
      console.error(
        "Student lookup failed:",
        studentError
      );

      return NextResponse.json(
        {
          success: false,
          error: studentError.message,
        },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: "Student not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Get ALL marks for this student's UUID.
     *
     * We deliberately do NOT filter by status.
     * Therefore DRAFT marks are returned too.
     */
    const {
      data: marks,
      error: marksError,
    } = await supabase
      .from("marks")
      .select("*")
      .eq("student_id", student.id);

    if (marksError) {
      console.error(
        "Student marks query failed:",
        marksError
      );

      return NextResponse.json(
        {
          success: false,
          error: marksError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,

      student,

      marks: marks ?? [],

      count: marks?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "Student marks API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load student marks.",
      },
      { status: 500 }
    );
  }
}