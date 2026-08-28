import { NextResponse } from "next/server";
import { createServerAuthClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerAuthClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return NextResponse.json({
        isAdmin: false,
      });
    }

    const adminEmail =
      process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!adminEmail) {
      console.error(
        "ADMIN_EMAIL is not configured in environment variables."
      );

      return NextResponse.json(
        {
          isAdmin: false,
          error: "ADMIN_EMAIL is not configured.",
        },
        { status: 500 }
      );
    }

    const isAdmin =
      user.email.trim().toLowerCase() === adminEmail;

    return NextResponse.json({
      isAdmin,
      email: isAdmin ? user.email : null,
    });
  } catch (error) {
    console.error("Admin check error:", error);

    return NextResponse.json(
      {
        isAdmin: false,
        error: "Admin check failed.",
      },
      { status: 500 }
    );
  }
}