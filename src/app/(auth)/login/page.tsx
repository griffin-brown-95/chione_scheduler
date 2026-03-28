"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

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

        {/* Heading */}
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
              fontFamily: "'Syne', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "var(--navy)",
              marginTop: 2,
            }}
          >
            Lane Management
          </p>
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

        {/* Divider */}
        <hr
          style={{
            border: "none",
            borderTop: "1px solid var(--border)",
            marginBottom: 20,
          }}
        />

        {/* Error */}
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
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
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--navy-light)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-strong)";
              }}
            />
          </div>

          {/* Password */}
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
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
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
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--navy-light)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-strong)";
              }}
            />
          </div>

          {/* Submit */}
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
