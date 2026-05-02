import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { supabase } from './supabase.js'

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleReset = async () => {
    if (!password || password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError('Erro ao definir senha. Tente novamente.'); }
    else { setSuccess(true); setTimeout(() => onDone(), 2000); }
  };

  const ACCENT = "#4080D0";
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#E8EEF8", fontFamily:"-apple-system,'Segoe UI',sans-serif" }}>
      <div style={{ background:"white", borderRadius:16, padding:"2.5rem 2rem", width:"100%", maxWidth:380, border:"1px solid #E2E8F4", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"2rem", justifyContent:"center" }}>
          <div style={{ width:36, height:36, borderRadius:10, background:ACCENT, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span style={{ fontWeight:700, fontSize:22, color:"#1E293B", letterSpacing:"-0.02em" }}>Meu<span style={{ color:ACCENT }}>Bolso</span></span>
        </div>
        <p style={{ fontSize:15, fontWeight:700, color:"#1E293B", textAlign:"center", marginBottom:6 }}>Definir senha</p>
        <p style={{ fontSize:13, color:"#64748B", textAlign:"center", marginBottom:"1.5rem" }}>Escolha uma senha para acessar sua conta</p>

        {success ? (
          <div style={{ background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:8, padding:"14px", textAlign:"center" }}>
            <p style={{ fontSize:14, color:"#16A34A", fontWeight:600 }}>✓ Senha definida! Entrando...</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"#64748B", marginBottom:5 }}>Nova senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus
                style={{ width:"100%", fontSize:14, border:"1px solid #D1D9E6", borderRadius:8, padding:"10px 12px", outline:"none", fontFamily:"inherit", color:"#1E293B", boxSizing:"border-box" }} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"#64748B", marginBottom:5 }}>Confirmar senha</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha"
                onKeyDown={e => e.key === "Enter" && handleReset()}
                style={{ width:"100%", fontSize:14, border:"1px solid #D1D9E6", borderRadius:8, padding:"10px 12px", outline:"none", fontFamily:"inherit", color:"#1E293B", boxSizing:"border-box" }} />
            </div>
            {error && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
                <p style={{ fontSize:13, color:"#DC2626", margin:0 }}>{error}</p>
              </div>
            )}
            <button onClick={handleReset} disabled={loading}
              style={{ width:"100%", background:loading?"#94A3B8":ACCENT, color:"white", border:"none", borderRadius:8, padding:"12px", fontSize:14, fontWeight:600, fontFamily:"inherit", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Salvando..." : "Definir senha e entrar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Root() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetting(true)
        setUser(session?.user ?? null)
      } else {
        setIsResetting(false)
        setUser(session?.user ?? null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#E8EEF8", fontFamily:"sans-serif" }}>
      <p style={{ color:"#94A3B8", fontSize:14 }}>Carregando...</p>
    </div>
  )

  if (isResetting && user) return <ResetPasswordScreen onDone={() => setIsResetting(false)} />
  if (!user) return <LoginScreen onLogin={setUser} />
  return <App user={user} onSignOut={() => setUser(null)} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
