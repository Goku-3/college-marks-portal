import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createAdminClient,
  createServerAuthClient,
} from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StudentRow = {
  id: string;
  student_id: string;
  name: string;
};

function clean(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalize(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function detectExamType(header: string): string {
  const h = normalize(header);

  if (h.includes("mid3") || h.includes("midiii")) return "MID 3";
  if (h.includes("mid2") || h.includes("midii")) return "MID 2";
  return "MID 1";
}

function parseMark(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    clean(value) === ""
  ) {
    return null;
  }

  const text = clean(value).replace(",", ".");
  const number = Number(text);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify the logged-in Supabase user.
    const authClient = await createServerAuthClient();

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be logged in as admin.",
        },
        { status: 401 }
      );
    }

    const adminEmail =
      process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ADMIN_EMAIL is not configured on the server.",
        },
        { status: 500 }
      );
    }

    if (user.email.toLowerCase() !== adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin access is required.",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    // page.tsx sends the exact UUID selected from public."Semesters".
    // Never invent/infer a semester UUID when creating a subject.
    const requestedSemesterId = clean(formData.get("semester_id"));
    const requestedExamType = clean(formData.get("exam_type"));

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No Excel file was received.",
        },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        {
          success: false,
          error: "Please upload an .xlsx Excel file.",
        },
        { status: 400 }
      );
    }

    // Keep uploads reasonably small for Vercel.
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "Excel file is too large. Maximum size is 10 MB.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: false,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return NextResponse.json(
        {
          success: false,
          error: "The Excel file contains no worksheet.",
        },
        { status: 400 }
      );
    }

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<
      Record<string, unknown>
    >(worksheet, {
      defval: "",
      raw: true,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The Excel worksheet is empty.",
        },
        { status: 400 }
      );
    }

    const headers = Object.keys(rows[0]);

    const studentIdHeader = headers.find((header) => {
      const h = normalize(header);
      return (
        h === "studentid" ||
        h === "studentno" ||
        h === "rollno" ||
        h === "rollnumber" ||
        h === "studentnumber"
      );
    });

    const studentNameHeader = headers.find((header) => {
      const h = normalize(header);
      return (
        h === "studentname" ||
        h === "name" ||
        h === "student"
      );
    });

    if (!studentIdHeader) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Student ID column could not be detected. Expected a column such as STUDENT ID.",
        },
        { status: 400 }
      );
    }

    if (!studentNameHeader) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Student Name column could not be detected. Expected a column such as STUDENT NAME.",
        },
        { status: 400 }
      );
    }

    // This project uploads one Excel file per subject.
    // Therefore the first remaining mark column is the subject/exam column.
    const markHeaders = headers.filter((header) => {
      const h = normalize(header);

      return (
        header !== studentIdHeader &&
        header !== studentNameHeader &&
        h !== "sno" &&
        h !== "serialno" &&
        h !== "serialnumber"
      );
    });

    if (markHeaders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No marks column was found in the Excel file.",
        },
        { status: 400 }
      );
    }

    // Your uploaded file has exactly one marks column:
    // MID-1(20), for the subject Probability and Random variables.
    const markHeader = markHeaders[0];
    const detectedExamType = detectExamType(markHeader);
    const allowedExamTypes = new Set(["MID 1", "MID 2", "MID 3"]);

    const examType =
      requestedExamType &&
      allowedExamTypes.has(requestedExamType.toUpperCase())
        ? requestedExamType.toUpperCase()
        : detectedExamType;

    // Use the filename as the subject name, removing the .xlsx extension.
    // Example:
    // Probability and Random variables(1).xlsx
    // -> Probability and Random variables
    let subjectName = file.name
      .replace(/\.xlsx$/i, "")
      .replace(/\(\d+\)\s*$/, "")
      .trim();

    if (!subjectName) {
      subjectName = "Probability and Random variables";
    }

    const supabase = createAdminClient();

    // IMPORTANT:
    // The FK reported by Supabase is:
    // subjects.semester_id -> public."Semesters".id
    //
    // Use the exact quoted table name. Prefer the semester UUID sent by
    // page.tsx, then verify that UUID really exists in "Semesters".
    let semesterQuery = supabase
      .from("Semesters")
      .select("id, semester_name");

    if (requestedSemesterId) {
      semesterQuery = semesterQuery.eq("id", requestedSemesterId);
    } else {
      semesterQuery = semesterQuery.ilike(
        "semester_name",
        "E2 Sem-1"
      );
    }

    const { data: semester, error: semesterError } =
      await semesterQuery.maybeSingle();

    if (semesterError) {
      console.error(
        "Semester lookup failed:",
        semesterError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            `Could not read public."Semesters": ${semesterError.message}`,
        },
        { status: 500 }
      );
    }

    if (!semester) {
      return NextResponse.json(
        {
          success: false,
          error: requestedSemesterId
            ? `The selected semester UUID does not exist in public."Semesters": ${requestedSemesterId}`
            : 'Semester "E2 Sem-1" was not found in public."Semesters".',
        },
        { status: 404 }
      );
    }

    // Only accept the selected semester; don't silently switch to another one.
    if (
      requestedSemesterId &&
      semester.id !== requestedSemesterId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected semester could not be verified.",
        },
        { status: 400 }
      );
    }

    // Find or create the subject under the verified semester UUID.
    // This is the value that satisfies subjects_semester_id_fkey.
    let { data: subject, error: subjectLookupError } =
      await supabase
        .from("subjects")
        .select("id, semester_id, subject_code, subject_name")
        .eq("semester_id", semester.id)
        .ilike("subject_name", subjectName)
        .maybeSingle();

    if (subjectLookupError) {
      console.error(
        "Subject lookup failed:",
        subjectLookupError
      );

      return NextResponse.json(
        {
          success: false,
          error: `Could not read subjects: ${subjectLookupError.message}`,
        },
        { status: 500 }
      );
    }

    if (subject && subject.semester_id !== semester.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The existing subject belongs to a different semester. " +
            "No marks were uploaded.",
        },
        { status: 409 }
      );
    }

    if (!subject) {
      const { data: createdSubject, error: createSubjectError } =
        await supabase
          .from("subjects")
          .insert({
            semester_id: semester.id,
            subject_code: null,
            subject_name: subjectName,
          })
          .select("id, semester_id, subject_code, subject_name")
          .single();

      if (createSubjectError || !createdSubject) {
        console.error(
          "Subject creation failed:",
          createSubjectError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              createSubjectError?.message ||
              "Could not create the subject.",
          },
          { status: 500 }
        );
      }

      subject = createdSubject;
    }

    // Load all students once and map by Student ID.
    const { data: students, error: studentsError } =
      await supabase
        .from("students")
        .select("id, student_id, name");

    if (studentsError) {
      console.error(
        "Students query failed:",
        studentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: `Could not read students: ${studentsError.message}`,
        },
        { status: 500 }
      );
    }

    const studentMap = new Map<string, StudentRow>();

    for (const student of (students ?? []) as StudentRow[]) {
      studentMap.set(
        clean(student.student_id).toLowerCase(),
        student
      );
    }

    const matchedStudentIds: string[] = [];
    const matchedRows: Array<{
      student: StudentRow;
      mark: number | null;
      rowNumber: number;
    }> = [];

    const errors: string[] = [];
    const seenExcelIds = new Set<string>();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      const excelStudentId = clean(
        row[studentIdHeader]
      );
      const excelName = clean(
        row[studentNameHeader]
      );

      const rowNumber = index + 2;

      if (!excelStudentId) {
        errors.push(
          `Row ${rowNumber}: Student ID is missing.`
        );
        continue;
      }

      const normalizedStudentId =
        excelStudentId.toLowerCase();

      if (seenExcelIds.has(normalizedStudentId)) {
        errors.push(
          `Row ${rowNumber}: Duplicate Student ID ${excelStudentId}.`
        );
        continue;
      }

      seenExcelIds.add(normalizedStudentId);

      const student =
        studentMap.get(normalizedStudentId);

      if (!student) {
        errors.push(
          `Row ${rowNumber}: Student ID ${excelStudentId} was not found in the database.`
        );
        continue;
      }

      // If the Excel contains a name, check it as a warning/error only
      // when it clearly differs. Student ID remains the authoritative key.
      if (
        excelName &&
        normalize(excelName) !== normalize(student.name)
      ) {
        errors.push(
          `Row ${rowNumber}: Student ID ${excelStudentId} matched ${student.name}, but Excel name is ${excelName}.`
        );
        continue;
      }

      const mark = parseMark(row[markHeader]);

      if (mark !== null && (mark < 0 || mark > 20)) {
        errors.push(
          `Row ${rowNumber}: Student ID ${excelStudentId} has invalid mark ${mark}. Maximum is 20.`
        );
        continue;
      }

      matchedStudentIds.push(student.id);
      matchedRows.push({
        student,
        mark,
        rowNumber,
      });
    }

    if (matchedRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid students from the Excel file matched the students table.",
          details: errors.slice(0, 20),
        },
        { status: 400 }
      );
    }

    // Get existing records for this subject/exam in one query.
    const { data: existingMarks, error: existingMarksError } =
      await supabase
        .from("marks")
        .select(
          "id, student_id, subject_id, exam_type, marks, attendance_status, status"
        )
        .eq("subject_id", subject.id)
        .eq("exam_type", examType);

    if (existingMarksError) {
      console.error(
        "Existing marks lookup failed:",
        existingMarksError
      );

      return NextResponse.json(
        {
          success: false,
          error: `Could not read existing marks: ${existingMarksError.message}`,
        },
        { status: 500 }
      );
    }

    const existingMap = new Map<
      string,
      {
        id: string;
      }
    >();

    for (const existing of existingMarks ?? []) {
      existingMap.set(existing.student_id, {
        id: existing.id,
      });
    }

    const rowsToInsert: Array<Record<string, unknown>> = [];
    const rowsToUpdate: Array<{
      id: string;
      marks: number | null;
      attendance_status: string;
      status: string;
    }> = [];

    let absent = 0;

    for (const item of matchedRows) {
      const attendanceStatus =
        item.mark === null ? "ABSENT" : "PRESENT";

      if (item.mark === null) {
        absent++;
      }

      const existing = existingMap.get(
        item.student.id
      );

      if (existing) {
        rowsToUpdate.push({
          id: existing.id,
          marks: item.mark,
          attendance_status: attendanceStatus,
          status: "DRAFT",
        });
      } else {
        rowsToInsert.push({
          student_id: item.student.id,
          subject_id: subject.id,
          exam_type: examType,
          marks: item.mark,
          attendance_status: attendanceStatus,
          status: "DRAFT",
        });
      }
    }

    // Insert all new records in one request.
    if (rowsToInsert.length > 0) {
      const { error: insertError } =
        await supabase
          .from("marks")
          .insert(rowsToInsert);

      if (insertError) {
        console.error(
          "Marks insert failed:",
          insertError
        );

        return NextResponse.json(
          {
            success: false,
            error: `Marks could not be inserted: ${insertError.message}`,
          },
          { status: 500 }
        );
      }
    }

    // Update existing records. There are only as many updates as
    // matching students, so this remains small for your 48-student class.
    for (const item of rowsToUpdate) {
      const { error: updateError } =
        await supabase
          .from("marks")
          .update({
            marks: item.marks,
            attendance_status:
              item.attendance_status,
            status: item.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

      if (updateError) {
        console.error(
          "Mark update failed:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            error: `A mark could not be updated: ${updateError.message}`,
          },
          { status: 500 }
        );
      }
    }

    const uploadedMarks = matchedRows.filter(
      (item) => item.mark !== null
    ).length;

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${uploadedMarks} marks for ${subjectName}.`,
      subject: subjectName,
      semester: semester.semester_name,
      examType,
      studentsProcessed: matchedRows.length,
      uploadedMarks,
      absent,
      newRecords: rowsToInsert.length,
      updatedRecords: rowsToUpdate.length,
      errors: errors.slice(0, 20),
      errorCount: errors.length,
    });
  } catch (error) {
    console.error("Marks upload API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process Excel upload.",
      },
      { status: 500 }
    );
  }
}
