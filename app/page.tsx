"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

type Semester = {
  id: string;
  semester_name: string;
  academic_year: string | null;
};

type Subject = {
  id: string;
  semester_id: string;
  subject_name: string;
  subject_code: string | null;
  maximum_marks: number;
};

type Student = {
  id: string;
  student_id: string;
  name: string;
};

type Mark = {
  id: string;
  student_id: string;
  subject_id: string;
  exam_type: string;
  marks: number | null;
  attendance_status: string;
  status: string;
};

type UploadResult = {
  success: boolean;
  message?: string;
  error?: string;
  subject?: string;
  semester?: string;
  examType?: string;
  studentsProcessed?: number;
  uploadedMarks?: number;
  absent?: number;
};

export default function Home() {
  const supabase = createClient();
  const router = useRouter();

  const [semesters, setSemesters] =
    useState<Semester[]>([]);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [marks, setMarks] =
    useState<Mark[]>([]);

  const [studentId, setStudentId] =
    useState("");

  const [student, setStudent] =
    useState<Student | null>(null);

  const [semesterId, setSemesterId] =
    useState("");

  const [examType, setExamType] =
    useState("Mid 1");

  const [loading, setLoading] =
    useState(true);

  const [searching, setSearching] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [adminEmail, setAdminEmail] =
    useState("");

  const [adminChecking, setAdminChecking] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [uploadResult, setUploadResult] =
    useState<UploadResult | null>(null);

  /*
   * =====================================================
   * LOAD DATABASE
   * =====================================================
   */

  async function loadPortal() {
    setLoading(true);
    setError("");

    const [semesterResult, subjectResult] =
      await Promise.all([
        supabase
          .from("semesters")
          .select("*")
          .order("semester_name"),

        supabase
          .from("subjects")
          .select("*")
          .order("subject_name"),
      ]);

    const loadedSubjects =
      (subjectResult.data ?? []) as Subject[];

    setSubjects(loadedSubjects);

    if (subjectResult.error) {
      setError(subjectResult.error.message);
      setLoading(false);
      return;
    }

    let loadedSemesters =
      (semesterResult.data ?? []) as Semester[];

    // Prefer E2 Sem-1. If the semester list is empty but subjects
    // contain a real semester UUID, use that UUID as a fallback.
    if (
      semesterResult.error ||
      loadedSemesters.length === 0
    ) {
      const inferredSemesterId =
        loadedSubjects.find(
          (subject) => !!subject.semester_id
        )?.semester_id;

      if (inferredSemesterId) {
        loadedSemesters = [
          {
            id: inferredSemesterId,
            semester_name: "E2 Sem-1",
            academic_year: null,
          },
        ];
      }
    }

    setSemesters(loadedSemesters);

    const e2Semester = loadedSemesters.find(
      (semester) =>
        semester.semester_name
          .trim()
          .toLowerCase() === "e2 sem-1"
    );

    if (e2Semester) {
      setSemesterId(e2Semester.id);
    } else if (loadedSemesters.length > 0) {
      setSemesterId(loadedSemesters[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadPortal();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * =====================================================
   * ADMIN CHECK
   * =====================================================
   */

  useEffect(() => {
    async function checkAdmin() {
      try {
        const response =
          await fetch(
            "/api/admin/check",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        if (!response.ok) {
          setIsAdmin(false);
          setAdminChecking(false);
          return;
        }

        const result =
          await response.json();

        if (result.isAdmin) {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          setIsAdmin(true);
          setAdminEmail(
            user?.email ?? ""
          );
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error(
          "Admin check failed:",
          err
        );

        setIsAdmin(false);
      }

      setAdminChecking(false);
    }

    checkAdmin();
  }, [supabase]);

  /*
   * =====================================================
   * SEARCH / STUDENT LOGIN
   * =====================================================
   */

  async function searchStudent() {
    setError("");
    setMessage("");
    setStudent(null);

    const id =
      studentId.trim();

    if (!id) {
      setError(
        "Please enter your Student ID to continue."
      );
      return;
    }

    setSearching(true);

    const {
      data,
      error: studentError,
    } = await supabase
      .from("students")
      .select("*")
      .ilike(
        "student_id",
        id
      )
      .maybeSingle();

    setSearching(false);

    if (studentError) {
      setError(
        studentError.message
      );
      return;
    }

    if (!data) {
      setError(
        "Student ID not found."
      );
      return;
    }

    /*
     * Successful student login.
     *
     * The results dashboard will now
     * automatically appear.
     */

    setStudent(
      data as Student
    );

    // Load this student's marks through the server API.
    const marksResponse = await fetch(
      `/api/marks/student?student_id=${encodeURIComponent(
        (data as Student).id
      )}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const marksResult = await marksResponse.json();

    if (
      !marksResponse.ok ||
      !marksResult.success
    ) {
      setError(
        marksResult.error ||
          "Could not load student marks."
      );
      return;
    }

    setMarks(
      (marksResult.marks ?? []) as Mark[]
    );

    setMessage(
      `Welcome! Your academic record is ready. ${
        marksResult.count ?? 0
      } mark(s) loaded.`
    );

    setTimeout(() => {
      document
        .getElementById(
          "student-record"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  /*
   * =====================================================
   * ADMIN EXCEL UPLOAD
   * =====================================================
   */

  async function uploadExcel(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!isAdmin) {
      setError(
        "Admin access is required."
      );

      event.target.value = "";
      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");
    setUploadResult(null);

    if (
      !file.name
        .toLowerCase()
        .endsWith(".xlsx")
    ) {
      setError(
        "Please select an .xlsx Excel file."
      );

      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/marks/upload",
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        (await response.json()) as UploadResult;

      if (
        !response.ok ||
        !result.success
      ) {
        setError(
          result.error ||
            "Upload failed."
        );
        return;
      }

      setMessage(
        result.message ||
          "Marks uploaded successfully."
      );

      setUploadResult(
        result
      );

      /*
       * Reload subjects and marks.
       *
       * New uploaded subjects will
       * automatically appear.
       */

      await loadPortal();
    } catch (err) {
      console.error(err);

      setError(
        "Could not connect to upload API."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   */

  async function logout() {
    await supabase.auth.signOut();

    setIsAdmin(false);
    setAdminEmail("");
  }

  /*
   * =====================================================
   * SUBJECTS FOR SELECTED SEMESTER
   * =====================================================
   */

  const semesterSubjects =
    useMemo(() => {
      return subjects
        .filter(
          (subject) =>
            subject.semester_id ===
            semesterId
        )
        .sort(
          (a, b) =>
            a.subject_name.localeCompare(
              b.subject_name
            )
        );
    }, [
      subjects,
      semesterId,
    ]);

  /*
   * =====================================================
   * STUDENT MARKS
   * =====================================================
   */

  const studentMarks =
    useMemo(() => {
      if (!student) {
        return [];
      }

      const normalize = (
        value: string | null | undefined
      ) =>
        String(value ?? "")
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, "");

      return semesterSubjects.map(
        (subject) => {
          const mark =
            marks.find(
              (item) =>
                String(item.student_id).trim() ===
                  String(student.id).trim() &&
                String(item.subject_id).trim() ===
                  String(subject.id).trim() &&
                normalize(item.exam_type) ===
                  normalize(examType)
            );

          return {
            subject,
            mark,
          };
        }
      );
    }, [
      student,
      semesterSubjects,
      marks,
      examType,
    ]);

  /*
   * =====================================================
   * CALCULATE RESULT
   * =====================================================
   */

  const presentMarks =
    studentMarks.filter(
      ({ mark }) =>
        mark &&
        mark.attendance_status
          ?.toUpperCase() ===
          "PRESENT" &&
        typeof mark.marks ===
          "number"
    );

  const totalMarks =
    presentMarks.reduce(
      (sum, item) =>
        sum +
        (item.mark?.marks ?? 0),
      0
    );

  const maximumMarks =
    presentMarks.reduce(
      (sum, item) =>
        sum +
        Number(
          item.subject
            .maximum_marks
        ),
      0
    );

  const percentage =
    maximumMarks > 0
      ? Math.round(
          (totalMarks /
            maximumMarks) *
            100
        )
      : 0;

  const currentSemester =
    semesters.find(
      (semester) =>
        semester.id ===
        semesterId
    );

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <main className="portal">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="header">

        <div className="header-inner">

          <div className="brand">

            <div className="logo">
              GH
            </div>

            <div className="brand-info">

              <span>
                GRADE HUB
              </span>

              <strong>
                Academic Records
              </strong>

            </div>

          </div>

          <div className="header-right">

            {isAdmin && (
              <span className="admin-badge">
                ADMIN
              </span>
            )}

            {isAdmin ? (
              <button
                className="header-button"
                onClick={
                  logout
                }
              >
                Sign out
              </button>
            ) : (
              <button
                className="header-button"
                onClick={() =>
                  router.push(
                    "/login"
                  )
                }
              >
                Admin access →
              </button>
            )}

          </div>

        </div>

      </header>

      {/* =================================================
          HERO / STUDENT LOGIN
      ================================================= */}

      {!student && (

        <section className="hero">

          <div className="hero-inner">

            <div className="hero-content">

              <div className="eyebrow">
                ACADEMIC RECORDS
                {" / "}
                {currentSemester
                  ?.academic_year ||
                  "2024–25"}
              </div>

              <h1>
                Marks,
                <br />
                <em>
                  made clear.
                </em>
              </h1>

              <p>
                A trusted space for
                every student&apos;s
                academic progress.
                Search your record
                using your Student ID.
              </p>

              <div className="stats">

                <div>
                  <strong>
                    {semesters.length
                      .toString()
                      .padStart(
                        2,
                        "0"
                      )}
                  </strong>

                  <span>
                    live semesters
                  </span>
                </div>

                <div>
                  <strong>
                    {semesterSubjects.length
                      .toString()
                      .padStart(
                        2,
                        "0"
                      )}
                  </strong>

                  <span>
                    subjects
                  </span>
                </div>

              </div>

            </div>

            {/* LOGIN CARD */}

            <div className="login-card">

              <div className="card-label">
                STUDENT ACCESS
              </div>

              <h2>
                View your marks
              </h2>

              <p>
                Enter your Student ID
                to access your academic
                record.
              </p>

              <div className="field">

                <label>
                  Student ID
                </label>

                <input
                  value={studentId}
                  onChange={(event) =>
                    setStudentId(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      searchStudent();
                    }
                  }}
                  placeholder="e.g. N210359"
                />

              </div>

              <div className="field">

                <label>
                  Semester
                </label>

                <select
                  value={semesterId}
                  onChange={(event) =>
                    setSemesterId(
                      event.target.value
                    )
                  }
                >
                  {semesters.length > 0 ? (
                    semesters.map(
                      (semester) => (
                        <option
                          key={semester.id}
                          value={semester.id}
                        >
                          {semester.semester_name
                            .trim()
                            .toLowerCase() ===
                          "e2 sem-1"
                            ? "E2 Sem-1"
                            : semester.semester_name}
                          {semester.academic_year &&
                          semester.semester_name
                            .trim()
                            .toLowerCase() !==
                            "e2 sem-1"
                            ? ` — ${semester.academic_year}`
                            : ""}
                        </option>
                      )
                    )
                  ) : (
                    <option value="">
                      E2 Sem-1
                    </option>
                  )}
                </select>

              </div>

              <div className="field">

                <label>
                  Examination
                </label>

                <select
                  value={examType}
                  onChange={(event) =>
                    setExamType(
                      event.target.value
                    )
                  }
                >

                  <option>
                    Mid 1
                  </option>

                  <option>
                    Mid 2
                  </option>

                  <option>
                    Mid 3
                  </option>

                </select>

              </div>

              <button
                className="view-button"
                onClick={
                  searchStudent
                }
                disabled={
                  searching ||
                  loading
                }
              >

                {searching
                  ? "Loading..."
                  : "View marks"}

                {!searching && (
                  <span>
                    →
                  </span>
                )}

              </button>

              <div className="secure">
                <span>
                  ●
                </span>

                Student records are
                securely retrieved.
              </div>

            </div>

          </div>

          {/* CURVES */}

          <div className="curve-bottom-left" />
          <div className="curve-bottom-right" />

          <div className="decorative-circle circle-one" />
          <div className="decorative-circle circle-two" />

        </section>
      )}

      {/* =================================================
          MESSAGES
      ================================================= */}

      <section className="main-content">

        {error && (
          <div className="message error">
            <span>!</span>
            {error}
          </div>
        )}

        {message && !student && (
          <div className="message success">
            <span>✓</span>
            {message}
          </div>
        )}

        {/* =================================================
            STUDENT DASHBOARD
        ================================================= */}

        {student && (

          <section
            id="student-record"
            className="student-dashboard"
          >

            {/* STUDENT HEADER */}

            <div className="student-card">

              <div>

                <div className="card-label">
                  STUDENT RECORD
                </div>

                <h2>
                  {student.name}
                </h2>

                <p>
                  STUDENT ID
                  <span>·</span>
                  {student.student_id}
                </p>

              </div>

              <div className="percentage">

                <span>
                  {examType}
                </span>

                <strong>
                  {percentage}%
                </strong>

              </div>

            </div>

            {/* SUMMARY */}

            <div className="summary">

              <div className="summary-card">

                <span>
                  TOTAL MARKS
                </span>

                <strong>
                  {totalMarks}
                  <small>
                    {" "}
                    /{" "}
                    {maximumMarks}
                  </small>
                </strong>

              </div>

              <div className="summary-card">

                <span>
                  SUBJECTS
                </span>

                <strong>
                  {
                    semesterSubjects.length
                  }
                </strong>

              </div>

              <div className="summary-card">

                <span>
                  SEMESTER
                </span>

                <strong className="semester-text">
                  {
                    currentSemester
                      ?.semester_name ||
                    "—"
                  }
                </strong>

              </div>

            </div>

            {/* SUBJECT MARKS */}

            <div className="marks-card">

              <div className="marks-card-header">

                <div>

                  <div className="card-label">
                    ACADEMIC PERFORMANCE
                  </div>

                  <h3>
                    Subject marks
                  </h3>

                </div>

                <span>
                  {
                    semesterSubjects.length
                  }{" "}
                  subjects
                </span>

              </div>

              <div className="table-container">

                <table>

                  <thead>

                    <tr>

                      <th>
                        SUBJECT
                      </th>

                      <th>
                        CODE
                      </th>

                      <th>
                        MAXIMUM
                      </th>

                      <th>
                        {examType.toUpperCase()}
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {studentMarks.length ===
                    0 ? (

                      <tr>

                        <td
                          colSpan={4}
                          className="empty"
                        >
                          No subjects
                          available for
                          this semester.
                        </td>

                      </tr>

                    ) : (

                      studentMarks.map(
                        ({
                          subject,
                          mark,
                        }) => {

                          let value =
                            "Not Uploaded";

                          let valueClass =
                            "not-uploaded";

                          if (
                            mark?.attendance_status?.toUpperCase() ===
                            "ABSENT"
                          ) {

                            value =
                              "A";

                            valueClass =
                              "absent";

                          } else if (
                            mark?.attendance_status?.toUpperCase() ===
                              "PRESENT" &&
                            typeof mark.marks ===
                              "number"
                          ) {

                            value =
                              `${mark.marks} / ${subject.maximum_marks}`;

                            valueClass =
                              "mark-value";

                          }

                          return (

                            <tr
                              key={
                                subject.id
                              }
                            >

                              <td>
                                <strong>
                                  {
                                    subject.subject_name
                                  }
                                </strong>
                              </td>

                              <td className="muted">
                                {
                                  subject.subject_code ||
                                  "—"
                                }
                              </td>

                              <td className="muted">
                                {
                                  subject.maximum_marks
                                }
                              </td>

                              <td>
                                <span
                                  className={
                                    valueClass
                                  }
                                >
                                  {value}
                                </span>
                              </td>

                            </tr>

                          );
                        }
                      )

                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* BACK BUTTON */}

            <button
              className="back-button"
              onClick={() => {
                setStudent(null);
                setMessage("");
                setError("");

                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
            >
              ← Search another student
            </button>

          </section>

        )}

        {/* =================================================
            ADMIN PANEL
        ================================================= */}

        {!adminChecking &&
          isAdmin && (

            <section className="admin-panel">

              <div className="admin-header">

                <div>

                  <div className="admin-label">
                    ADMINISTRATION
                  </div>

                  <h2>
                    Manage class records
                  </h2>

                  <p>
                    Signed in as{" "}
                    <strong>
                      {adminEmail}
                    </strong>
                  </p>

                </div>

                <div className="admin-icon">
                  🔐
                </div>

              </div>

              <div className="upload-box">

                <div className="upload-icon">
                  ↑
                </div>

                <div className="upload-text">

                  <h3>
                    Upload subject marks
                  </h3>

                  <p>
                    Upload one Excel file
                    for each subject.
                    Student IDs are used
                    for exact mapping.
                  </p>

                  <label className="upload-button">

                    {uploading
                      ? "Processing..."
                      : "Choose Excel file"}

                    <input
                      type="file"
                      accept=".xlsx"
                      disabled={
                        uploading
                      }
                      onChange={
                        uploadExcel
                      }
                    />

                  </label>

                </div>

              </div>

              {/* CURRENT SUBJECTS */}

              <div className="admin-subjects">

                <div className="admin-subject-heading">

                  <span>
                    SUBJECTS IN CURRENT
                    SEMESTER
                  </span>

                  <strong>
                    {
                      semesterSubjects.length
                    }
                  </strong>

                </div>

                {semesterSubjects.map(
                  (subject, index) => (
                    <div
                      className="admin-subject"
                      key={
                        subject.id
                      }
                    >

                      <span className="subject-number">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <div>
                        <strong>
                          {
                            subject.subject_name
                          }
                        </strong>

                        <span>
                          {
                            subject.subject_code ||
                            "Subject"
                          }
                        </span>
                      </div>

                    </div>
                  )
                )}

              </div>

              {uploadResult?.success && (

                <div className="upload-result">

                  <div>
                    <span>
                      SUBJECT
                    </span>

                    <strong>
                      {
                        uploadResult.subject
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      PROCESSED
                    </span>

                    <strong>
                      {
                        uploadResult.studentsProcessed ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      MARKS
                    </span>

                    <strong>
                      {
                        uploadResult.uploadedMarks ??
                        0
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      ABSENT
                    </span>

                    <strong>
                      {
                        uploadResult.absent ??
                        0
                      }
                    </strong>
                  </div>

                </div>

              )}

            </section>

          )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer>

          <div>

            <strong>
              GRADE HUB
            </strong>

            <span>
              Academic Records Portal
            </span>

          </div>

          <span>
            Secure · Simple · Clear
          </span>

        </footer>

      </section>

      {/* =================================================
          CSS
      ================================================= */}

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .portal {
          min-height: 100vh;
          background: #f5f7fa;
          color: #14213d;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        /* =========================
           HEADER
        ========================= */

        .header {
          height: 78px;
          background: #101f3a;
          color: white;
        }

        .header-inner {
          height: 100%;
          max-width: 1200px;
          margin: auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
        }

        .brand {
          display: flex;
          align-items: center;
        }

        .logo {
          width: 40px;
          height: 40px;
          border-radius: 9px;
          background: #3678f5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .brand-info {
          margin-left: 13px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brand-info span {
          color: #91b5ff;
          font-size: 9px;
          letter-spacing: 2px;
        }

        .brand-info strong {
          font-size: 13px;
          font-weight: 500;
        }

        .header-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-button {
          background: transparent;
          border: 1px solid
            rgba(255,255,255,0.2);
          border-radius: 7px;
          color: white;
          padding: 9px 14px;
          cursor: pointer;
          font-size: 10px;
        }

        .header-button:hover {
          background: rgba(
            255,
            255,
            255,
            0.08
          );
        }

        .admin-badge {
          color: #8eb2ff;
          border: 1px solid
            rgba(142,178,255,0.3);
          padding: 7px 9px;
          border-radius: 20px;
          font-size: 8px;
          letter-spacing: 1.5px;
        }

        /* =========================
           HERO
        ========================= */

        .hero {
          position: relative;
          min-height: 640px;
          overflow: hidden;
          background: #101f3a;
          color: white;

          border-radius:
            0 0 42px 42px;
        }

        .hero-inner {
          position: relative;
          z-index: 5;

          max-width: 1200px;
          min-height: 640px;
          margin: auto;

          padding:
            55px 32px 90px;

          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            440px;

          gap: 85px;
          align-items: center;
        }

        .hero-content {
          position: relative;
          z-index: 5;
        }

        .eyebrow {
          color: #76a5ff;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: 700;
          margin-bottom: 24px;
        }

        .hero-content h1 {
          margin: 0;
          font-size: clamp(
            60px,
            7vw,
            88px
          );
          line-height: 0.87;
          font-weight: 300;
          letter-spacing: -5px;
        }

        .hero-content h1 em {
          color: #82abff;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-weight: 400;
        }

        .hero-content p {
          max-width: 450px;
          margin-top: 32px;
          color: #c2cee1;
          font-size: 14px;
          line-height: 1.75;
        }

        .stats {
          display: flex;
          gap: 65px;
          margin-top: 42px;
        }

        .stats div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .stats strong {
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: 27px;
        }

        .stats span {
          color: #9dafc8;
          font-size: 10px;
        }

        /* =========================
           LOGIN CARD
        ========================= */

        .login-card {
          position: relative;
          z-index: 10;

          padding: 35px;
          background: #f8fafc;
          color: #14213d;
          border-radius: 15px;

          box-shadow:
            0 28px 70px
              rgba(0,0,0,0.25);
        }

        .card-label {
          color: #728095;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: 700;
        }

        .login-card h2 {
          margin:
            15px 0 7px;
          font-size: 28px;
          font-weight: 400;
          letter-spacing: -1.3px;
        }

        .login-card > p {
          margin:
            0 0 26px;
          color: #78869a;
          font-size: 12px;
          line-height: 1.6;
        }

        .field {
          margin-bottom: 16px;
        }

        .field label {
          display: block;
          color: #67768a;
          font-size: 10px;
          margin-bottom: 7px;
        }

        .field input,
        .field select {
          width: 100%;
          height: 45px;
          padding: 0 12px;
          border: 1px solid #d7dfe9;
          border-radius: 6px;
          background: white;
          color: #172033;
          outline: none;
          font-size: 12px;
        }

        .field input:focus,
        .field select:focus {
          border-color: #3678f5;
          box-shadow:
            0 0 0 3px
              rgba(
                54,
                120,
                245,
                0.1
              );
        }

        .view-button {
          width: 100%;
          height: 46px;
          border: 0;
          border-radius: 6px;
          background: #2864e8;
          color: white;
          cursor: pointer;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;

          font-size: 12px;
          font-weight: 700;

          box-shadow:
            0 9px 22px
              rgba(
                40,
                100,
                232,
                0.22
              );
        }

        .view-button:hover {
          background: #2059d4;
        }

        .view-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .view-button span {
          font-size: 18px;
        }

        .secure {
          margin-top: 15px;
          text-align: center;
          color: #9aa6b5;
          font-size: 9px;
        }

        .secure span {
          color: #35a66a;
          margin-right: 5px;
        }

        /* =========================
           HERO CURVES
        ========================= */

        .curve-bottom-left,
        .curve-bottom-right {
          position: absolute;
          z-index: 3;
          bottom: 0;
          width: 85px;
          height: 85px;
          background: #f5f7fa;
        }

        .curve-bottom-left {
          left: 0;
          border-radius:
            0 85px 0 0;
        }

        .curve-bottom-right {
          right: 0;
          border-radius:
            85px 0 0 0;
        }

        .decorative-circle {
          position: absolute;
          z-index: 1;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.1
            );
          border-radius: 50%;
        }

        .circle-one {
          width: 520px;
          height: 520px;
          right: -260px;
          bottom: -330px;
        }

        .circle-two {
          width: 340px;
          height: 340px;
          right: -170px;
          bottom: -225px;
        }

        /* =========================
           CONTENT
        ========================= */

        .main-content {
          max-width: 1200px;
          margin: auto;
          padding:
            40px 32px 65px;
        }

        .message {
          padding:
            13px 17px;
          margin-bottom: 18px;
          border-radius: 8px;
          font-size: 12px;
        }

        .message span {
          margin-right: 8px;
          font-weight: 800;
        }

        .message.error {
          background: #fff1f0;
          color: #b42318;
          border: 1px solid #ffd5d1;
        }

        .message.success {
          background: #effbf3;
          color: #18713a;
          border: 1px solid #c9efd5;
        }

        /* =========================
           STUDENT DASHBOARD
        ========================= */

        .student-dashboard {
          scroll-margin-top: 20px;
        }

        .student-card {
          background: white;
          border-radius: 15px;
          padding:
            28px 30px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          box-shadow:
            0 6px 25px
              rgba(
                16,
                31,
                58,
                0.05
              );
        }

        .student-card h2 {
          margin:
            12px 0 5px;
          font-size: 29px;
          font-weight: 400;
          letter-spacing: -1px;
        }

        .student-card p {
          margin: 0;
          color: #8995a5;
          font-size: 10px;
          letter-spacing: 0.7px;
        }

        .student-card p span {
          margin: 0 7px;
        }

        .percentage {
          text-align: right;
        }

        .percentage span {
          display: block;
          color: #7b8798;
          font-size: 9px;
          letter-spacing: 1.5px;
          margin-bottom: 4px;
        }

        .percentage strong {
          color: #2864e8;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: 42px;
          font-weight: 400;
        }

        /* =========================
           SUMMARY
        ========================= */

        .summary {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 14px;
          margin:
            14px 0;
        }

        .summary-card {
          min-height: 110px;
          padding: 22px;
          background: white;
          border-radius: 12px;

          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .summary-card span {
          color: #8995a5;
          font-size: 9px;
          letter-spacing: 1.4px;
        }

        .summary-card strong {
          color: #14213d;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
          font-size: 29px;
          font-weight: 400;
        }

        .summary-card small {
          color: #94a0af;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 12px;
        }

        .semester-text {
          font-family:
            Arial,
            Helvetica,
            sans-serif !important;
          font-size: 15px !important;
          font-weight: 600 !important;
        }

        /* =========================
           MARKS
        ========================= */

        .marks-card {
          background: white;
          border-radius: 15px;
          overflow: hidden;

          box-shadow:
            0 6px 25px
              rgba(
                16,
                31,
                58,
                0.05
              );
        }

        .marks-card-header {
          padding:
            26px 28px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border-bottom:
            1px solid #edf0f4;
        }

        .marks-card-header h3 {
          margin:
            10px 0 0;
          font-size: 22px;
          font-weight: 400;
        }

        .marks-card-header > span {
          color: #8793a3;
          font-size: 10px;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
        }

        th {
          padding:
            14px 28px;
          background: #fafbfd;
          color: #7c899b;
          font-size: 9px;
          letter-spacing: 1px;
          text-align: left;
        }

        td {
          padding:
            18px 28px;
          border-top:
            1px solid #eef1f5;
          font-size: 12px;
        }

        td strong {
          color: #1d2939;
          font-weight: 600;
        }

        .muted {
          color: #8995a5;
        }

        .mark-value {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 86px;
          padding: 10px 14px;
          border-radius: 9px;
          background: #dce9ff;
          color: #1757d2;
          border: 1px solid #b9d0ff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.2px;
          box-shadow:
            0 5px 14px
              rgba(
                40,
                100,
                232,
                0.14
              );
        }

        .marks-card tbody tr:hover {
          background: #f8fbff;
        }

        .absent {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff0f0;
          color: #c53939;
          font-weight: 800;
        }

        .not-uploaded {
          color: #a2acb9;
          font-size: 11px;
          font-style: italic;
        }

        .empty {
          padding: 40px;
          text-align: center;
          color: #8995a5;
        }

        .back-button {
          margin-top: 18px;
          border: 0;
          background: transparent;
          color: #2864e8;
          font-size: 11px;
          cursor: pointer;
          padding: 8px 0;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        /* =========================
           ADMIN
        ========================= */

        .admin-panel {
          margin-top: 38px;
          padding: 30px;
          background: #101f3a;
          color: white;
          border-radius: 15px;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
        }

        .admin-label {
          color: #82abff;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: 700;
        }

        .admin-header h2 {
          margin:
            11px 0 6px;
          font-size: 25px;
          font-weight: 400;
        }

        .admin-header p {
          margin: 0;
          color: #a2b2ca;
          font-size: 11px;
        }

        .admin-icon {
          width: 43px;
          height: 43px;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-box {
          margin-top: 25px;
          padding: 25px;
          border: 1px dashed
            rgba(
              255,
              255,
              255,
              0.2
            );
          border-radius: 10px;

          display: flex;
          align-items: center;
          gap: 18px;
        }

        .upload-icon {
          width: 46px;
          height: 46px;
          border-radius: 9px;
          background: #2864e8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }

        .upload-text h3 {
          margin:
            0 0 5px;
          font-size: 15px;
        }

        .upload-text p {
          margin:
            0 0 13px;
          color: #a8b7ce;
          font-size: 11px;
        }

        .upload-button {
          display: inline-block;
          padding:
            9px 13px;
          border-radius: 6px;
          background: white;
          color: #14213d;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .upload-button input {
          display: none;
        }

        /* =========================
           ADMIN SUBJECTS
        ========================= */

        .admin-subjects {
          margin-top: 22px;
        }

        .admin-subject-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .admin-subject-heading span {
          color: #8fa1bb;
          font-size: 8px;
          letter-spacing: 1.5px;
        }

        .admin-subject-heading strong {
          width: 27px;
          height: 27px;
          border-radius: 50%;
          background: rgba(
            255,
            255,
            255,
            0.08
          );
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        .admin-subject {
          padding:
            11px 14px;
          margin-bottom: 7px;
          background: rgba(
            255,
            255,
            255,
            0.05
          );
          border-radius: 7px;

          display: flex;
          align-items: center;
        }

        .subject-number {
          width: 35px;
          color: #6f91ce;
          font-family:
            Georgia,
            "Times New Roman",
            serif;
        }

        .admin-subject div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .admin-subject div strong {
          font-size: 11px;
        }

        .admin-subject div span {
          color: #8fa1bb;
          font-size: 8px;
        }

        /* =========================
           UPLOAD RESULT
        ========================= */

        .upload-result {
          margin-top: 15px;
          padding: 17px;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          border-radius: 9px;

          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 15px;
        }

        .upload-result div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .upload-result span {
          color: #8fa2bf;
          font-size: 8px;
          letter-spacing: 1.2px;
        }

        .upload-result strong {
          font-size: 13px;
        }

        /* =========================
           FOOTER
        ========================= */

        footer {
          margin-top: 48px;
          padding-top: 22px;
          border-top:
            1px solid #e0e5eb;

          display: flex;
          align-items: center;
          justify-content: space-between;

          color: #8b96a5;
          font-size: 10px;
        }

        footer div {
          display: flex;
          gap: 10px;
        }

        footer strong {
          color: #14213d;
          letter-spacing: 1px;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 900px) {

          .hero-inner {
            grid-template-columns: 1fr;
            gap: 35px;
            padding-top: 50px;
            padding-bottom: 80px;
          }

          .hero {
            min-height: auto;
          }

          .hero-inner {
            min-height: auto;
          }

          .login-card {
            max-width: 520px;
          }

          .summary {
            grid-template-columns:
              1fr 1fr;
          }

        }

        @media (max-width: 600px) {

          .header {
            height: 68px;
          }

          .header-inner {
            padding:
              0 18px;
          }

          .brand-info {
            display: none;
          }

          .hero {
            border-radius:
              0 0 28px 28px;
          }

          .hero-inner {
            padding:
              42px 20px 70px;
          }

          .hero-content h1 {
            font-size: 58px;
            letter-spacing: -3px;
          }

          .hero-content p {
            font-size: 13px;
          }

          .login-card {
            padding: 25px;
          }

          .main-content {
            padding:
              25px 18px 45px;
          }

          .student-card {
            padding: 23px;
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }

          .percentage {
            text-align: left;
          }

          .summary {
            grid-template-columns: 1fr;
          }

          .admin-panel {
            padding: 22px;
          }

          .upload-box {
            flex-direction: column;
            align-items: flex-start;
          }

          .upload-result {
            grid-template-columns:
              1fr 1fr;
          }

          footer {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .curve-bottom-left,
          .curve-bottom-right {
            width: 55px;
            height: 55px;
          }

        }

      `}</style>

    </main>
  );
}