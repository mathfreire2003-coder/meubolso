import { useState } from "react";
import { signIn } from "./supabase.js";

const ACCENT = "#4080D0";

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Preencha email e senha."); return; }
    setLoading(true); setError("");
    const { data, error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError("Email ou senha incorretos.");
    } else {
      onLogin(data.user);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#E8EEF8", fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 16, padding: "2.5rem 2rem", width: "100%", maxWidth: 380, border: "1px solid #E2E8F4", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "2rem", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 22, color: "#1E293B", letterSpacing: "-0.02em" }}>Meu<span style={{ color: ACCENT }}>Bolso</span></span>
        </div>

        <p style={{ fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: "1.75rem" }}>
          Entre na sua conta para continuar
        </p>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748B", marginBottom: 5 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com" autoFocus
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", fontSize: 14, border: "1px solid #D1D9E6", borderRadius: 8, padding: "10px 12px", outline: "none", fontFamily: "inherit", color: "#1E293B", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748B", marginBottom: 5 }}>Senha</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ width: "100%", fontSize: 14, border: "1px solid #D1D9E6", borderRadius: 8, padding: "10px 12px", outline: "none", fontFamily: "inherit", color: "#1E293B", boxSizing: "border-box" }}
          />
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#DC2626", margin: 0 }}>{error}</p>
          </div>
        )}

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", background: loading ? "#94A3B8" : ACCENT, color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: "1.5rem" }}>
          Acesso restrito. Solicite ao administrador para criar sua conta.
        </p>
      </div>
    </div>
  );
}
