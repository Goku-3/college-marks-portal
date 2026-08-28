"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="brand-mark">GH</div>

        <div className="brand-content">
          <div className="eyebrow">
            ACADEMIC RECORDS / 2024–25
          </div>

          <h1>
            Marks,
            <br />
            <em>made clear.</em>
          </h1>

          <p>
            A trusted space for every
            student&apos;s progress —
            from upload to publish.
          </p>
        </div>

        <div className="stats">
          <div>
            <strong>05</strong>
            <span>active students</span>
          </div>

          <div>
            <strong>01</strong>
            <span>live semester</span>
          </div>
        </div>

        <div className="circle" />
      </section>

      <section className="form-panel">
        <div className="form-container">
          <div className="lock-icon">
            <span>♙</span>
          </div>

          <div className="form-eyebrow">
            ADMIN ACCESS
          </div>

          <h2>Welcome back</h2>

          <p className="subtitle">
            Sign in to manage your class records.
          </p>

          <form onSubmit={login}>
            <label>Email address</label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />

            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </span>

              {!loading && (
                <span className="arrow">
                  →
                </span>
              )}
            </button>
          </form>

          <button
            type="button"
            className="student-link"
            onClick={() => router.push("/")}
          >
            I&apos;m a student
            <span>→</span>
          </button>

          <div className="demo">
            Admin access is restricted to
            authorized users.
          </div>
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 53.5% 46.5%;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          background: #f8fafc;
        }

        /* LEFT SIDE */

        .brand-panel {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background: #101f3a;
          color: white;
          padding: 70px 10%;
          display: flex;
          flex-direction: column;
        }

        .brand-mark {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #3678f5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .brand-content {
          margin-top: auto;
          margin-bottom: 100px;
          position: relative;
          z-index: 2;
        }

        .eyebrow,
        .form-eyebrow {
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: 600;
        }

        .eyebrow {
          color: #73a4ff;
          margin-bottom: 25px;
        }

        .brand-content h1 {
          margin: 0;
          font-size: clamp(55px, 6vw, 78px);
          line-height: 0.92;
          font-weight: 300;
          letter-spacing: -4px;
        }

        .brand-content h1 em {
          color: #7ca8ff;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 400;
        }

        .brand-content p {
          max-width: 420px;
          margin-top: 30px;
          color: #c5d1e5;
          font-size: 15px;
          line-height: 1.7;
        }

        .stats {
          position: relative;
          z-index: 2;
          display: flex;
          gap: 65px;
        }

        .stats div {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .stats strong {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 27px;
        }

        .stats span {
          font-size: 11px;
          color: #aebed6;
        }

        .circle {
          position: absolute;
          width: 480px;
          height: 480px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 50%;
          right: -220px;
          bottom: -180px;
        }

        .circle::after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 50%;
          left: 90px;
          top: 90px;
        }

        /* RIGHT SIDE */

        .form-panel {
          min-height: 100vh;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 50px;
        }

        .form-container {
          width: 100%;
          max-width: 370px;
        }

        .lock-icon {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #eaf1ff;
          color: #2764d8;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
        }

        .lock-icon span {
          font-size: 17px;
        }

        .form-eyebrow {
          color: #7b8799;
          margin-bottom: 20px;
        }

        .form-container h2 {
          margin: 0;
          font-size: 31px;
          font-weight: 400;
          letter-spacing: -1.5px;
          color: #111827;
        }

        .subtitle {
          margin: 10px 0 35px;
          color: #7b8799;
          font-size: 14px;
        }

        form {
          display: flex;
          flex-direction: column;
        }

        label {
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.7px;
          margin-bottom: 8px;
        }

        input {
          width: 100%;
          height: 46px;
          border: 1px solid #d7dee9;
          border-radius: 6px;
          background: white;
          padding: 0 13px;
          font-size: 13px;
          color: #172033;
          outline: none;
          margin-bottom: 22px;
          transition:
            border-color 0.2s,
            box-shadow 0.2s;
        }

        input:focus {
          border-color: #4b82ef;
          box-shadow:
            0 0 0 3px rgba(75, 130, 239, 0.1);
        }

        input::placeholder {
          color: #a6afbd;
        }

        .error {
          background: #fff0f0;
          color: #b42318;
          border: 1px solid #ffd5d2;
          border-radius: 6px;
          padding: 11px;
          font-size: 12px;
          margin-top: -7px;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        form button {
          height: 46px;
          border: none;
          border-radius: 6px;
          background: #2864e8;
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow:
            0 8px 18px rgba(40, 100, 232, 0.18);
          transition:
            transform 0.15s,
            background 0.15s;
        }

        form button:hover {
          background: #1f58d5;
          transform: translateY(-1px);
        }

        form button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .arrow {
          font-size: 18px;
          line-height: 1;
        }

        .student-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          background: transparent;
          color: #3472e8;
          font-size: 12px;
          margin: 25px auto 0;
          cursor: pointer;
        }

        .student-link span {
          font-size: 17px;
        }

        .student-link:hover {
          text-decoration: underline;
        }

        .demo {
          text-align: center;
          margin-top: 35px;
          color: #a2adbd;
          font-size: 10px;
          line-height: 1.6;
        }

        @media (max-width: 850px) {
          .login-page {
            grid-template-columns: 1fr;
          }

          .brand-panel {
            min-height: 390px;
            padding: 35px 30px;
          }

          .brand-content {
            margin-top: 70px;
            margin-bottom: 50px;
          }

          .brand-content h1 {
            font-size: 55px;
          }

          .form-panel {
            min-height: 600px;
            padding: 35px 25px;
          }
        }

        @media (max-width: 480px) {
          .brand-panel {
            min-height: 350px;
          }

          .brand-content h1 {
            font-size: 45px;
            letter-spacing: -2px;
          }

          .stats {
            gap: 40px;
          }

          .circle {
            right: -280px;
          }
        }
      `}</style>
    </main>
  );
}