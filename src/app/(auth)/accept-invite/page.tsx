"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "set-password" | "invalid" | "success";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase sets the session from the invite hash automatically when the
    // page loads. We just need to confirm we have an active session.
    async function checkSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // We have a session — either from the invite hash or an existing login
        setStep("set-password");
      } else {
        // No session found — invite link is invalid or expired
        setStep("invalid");
      }
    }

    checkSession();
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r)",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    color: "var(--text)",
    background: "var(--surface)",
    outline: "none",
    transition: "border 0.15s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-xl)",
          maxWidth: 400,
          width: "100%",
          padding: "32px 28px",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* Olympic rings */}
        <div
          style={{
            display: "flex",
            gap: 4,
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2.5px solid #4FC3F7",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2.5px solid #FFD54F",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2.5px solid #EF5350",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2.5px solid #66BB6A",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2.5px solid #EF5350",
              display: "inline-block",
              opacity: 0.5,
            }}
          />
        </div>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--navy-dark)",
              lineHeight: 1.2,
            }}
          >
            Olympic Park
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-hint)",
              marginTop: 4,
            }}
          >
            Park City · Utah
          </p>
        </div>

        <hr
          style={{
            border: "none",
            borderTop: "1px solid var(--border)",
            marginBottom: 20,
          }}
        />

        {step === "loading" && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: "3px solid var(--border)",
                borderTopColor: "var(--navy)",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            Verifying invite link…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === "invalid" && (
          <div>
            <div
              style={{
                background: "var(--red-bg)",
                color: "var(--red)",
                border: "1px solid var(--red-border)",
                borderRadius: "var(--r)",
                padding: "12px 14px",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Invalid or expired invite link.
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Please contact your administrator for a new invite.
            </p>
          </div>
        )}

        {step === "set-password" && (
          <div>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 4,
                color: "var(--text)",
              }}
            >
              Create your password
            </h2>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                marginBottom: 18,
              }}
            >
              Choose a secure password to complete your account setup.
            </p>

            {error && (
              <div
                style={{
                  background: "var(--red-bg)",
                  color: "var(--red)",
                  border: "1px solid var(--red-border)",
                  borderRadius: "var(--r)",
                  padding: "9px 13px",
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSetPassword}>
              <div style={{ marginBottom: 13 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    letterSpacing: "0.02em",
                  }}
                >
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--navy-light)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border-strong)";
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                    letterSpacing: "0.02em",
                  }}
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--navy-light)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border-strong)";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "9px 13px",
                  background: loading ? "var(--navy-mid)" : "var(--navy)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--r)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!loading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--navy-dark)";
                }}
                onMouseLeave={(e) => {
                  if (!loading)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--navy)";
                }}
              >
                {loading ? "Setting password…" : "Set Password"}
              </button>
            </form>
          </div>
        )}

        {step === "success" && (
          <div
            style={{
              textAlign: "center",
              padding: "10px 0",
              color: "var(--green)",
              fontSize: 13,
            }}
          >
            Password set successfully. Redirecting…
          </div>
        )}
      </div>
    </div>
  );
}
