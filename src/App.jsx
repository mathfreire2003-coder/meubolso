import { useState, useEffect, useCallback } from "react";
import { dbLoad, dbSave } from "./supabase.js";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, XAxis, YAxis } from "recharts";
import { ComposedChart, Line, Legend } from "recharts";

const STORAGE_KEYS = {
  installments: "finapp_installments_v3",
  fixedExpenses: "finapp_fixed_expenses_v3",
  goals: "finapp_goals_v3",
  settings: "finapp_settings_v3",
  transactions: "finapp_transactions_v1",
  budgets: "finapp_budgets_v1",
};

const CATEGORIES = ["Alimentação","Transporte","Saúde","Educação","Lazer","Vestuário","Casa","Tecnologia","Assinaturas","Carro","Presentes","Outros"];
const CAT_COLORS = ["#4080D0","#22C4A0","#F5734A","#A855F7","#F59E0B","#EC4899","#10B981","#6366F1","#14B8A6","#DC2626","#F43F5E","#94A3B8"];

const CREDIT_CARDS = ["Santander","Nubank","Nubank PJ","Will Bank","Mercado Pago","Pan","Caixa"];
const CARD_META = {
  "Santander":    { color: "#CC2929", light: "#FEF2F2", text: "#991B1B" },
  "Nubank":       { color: "#8B5CF6", light: "#F5F3FF", text: "#6D28D9" },
  "Nubank PJ":    { color: "#6D28D9", light: "#EDE9FE", text: "#5B21B6" },
  "Will Bank":    { color: "#D97706", light: "#FFFBEB", text: "#B45309" },
  "Mercado Pago": { color: "#0EA5E9", light: "#F0F9FF", text: "#0284C7" },
  "Pan":          { color: "#1D4ED8", light: "#EFF6FF", text: "#1E40AF" },
  "Caixa":        { color: "#0369A1", light: "#F0F9FF", text: "#075985" },
};

// Closing day of each card's billing cycle
const CARD_CLOSING = {
  "Santander": 1, "Nubank": 2, "Nubank PJ": 2,
  "Will Bank": 8, "Mercado Pago": 5, "Caixa": 8, "Pan": 10,
};
// Due date of each card
const CARD_DUE = {
  "Santander": 8, "Nubank": 9, "Nubank PJ": 9,
  "Will Bank": 15, "Mercado Pago": 12, "Caixa": 18, "Pan": 17,
};

// Returns YYYY-MM of the billing month (when bill is due) for a credit purchase
function getBillingMonth(purchaseDateStr, cardName) {
  if (!purchaseDateStr || !CARD_CLOSING[cardName]) return purchaseDateStr?.slice(0, 7);
  const d = new Date(purchaseDateStr + "T00:00:00");
  const closingDay = CARD_CLOSING[cardName];
  const purchaseDay = d.getDate();
  // If purchase day > closing day → next month's bill
  const billingDate = new Date(d.getFullYear(), d.getMonth(), 1);
  if (purchaseDay > closingDay) billingDate.setMonth(billingDate.getMonth() + 1);
  return `${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, "0")}`;
}

function getBillingLabel(purchaseDateStr, cardName) {
  const bm = getBillingMonth(purchaseDateStr, cardName);
  if (!bm) return null;
  const [y, m] = bm.split("-").map(Number);
  return `Fatura ${MONTH_PT[m - 1]}/${String(y).slice(2)}`;
}

const isCreditCard = (payment) => CREDIT_CARDS.includes(payment);

const FIXED_PAYMENT_METHODS = ["Pix","Débito","Boleto","Dinheiro",...CREDIT_CARDS];
const PAYMENT_METHODS = ["Dinheiro","Débito","Pix","Boleto",...CREDIT_CARDS,"Outro"];
const PM_COLOR = {
  "Dinheiro":"#16A34A","Débito":"#0369A1","Pix":"#22C4A0","Boleto":"#475569","Outro":"#94A3B8",
  "Santander":"#CC2929","Nubank":"#8B5CF6","Nubank PJ":"#6D28D9","Will Bank":"#D97706",
  "Mercado Pago":"#0EA5E9","Pan":"#1D4ED8","Caixa":"#0369A1",
};

const MONTH_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const ACCENT = "#4080D0";
const BG = "#F0F4FA";
const SIDEBAR_W = 168;

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };

function getEndDate(inst) {
  if (!inst.startDate) return null;
  const start = new Date(inst.startDate + "T00:00:00");
  return addMonths(start, inst.totalInstallments - inst.paidInstallments);
}

function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function parseMonthKey(k) { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1); }
function labelMonth(k) { const d = parseMonthKey(k); return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }

async function load(key, fallback) { return dbLoad(key, fallback); }
async function save(key, val) { dbSave(key, val); }

const css = `
  .fe * { box-sizing: border-box; margin: 0; padding: 0; }
  .fe { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
  .fe input, .fe select { font-family: inherit; font-size: 13px; border: 1px solid #D1D9E6; border-radius: 7px; padding: 7px 10px; outline: none; background: white; color: #1E293B; width: 100%; }
  .fe input:focus, .fe select:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px ${ACCENT}22; }
  .nav-item { display: flex; align-items: center; gap: 9px; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748B; transition: all 0.15s; user-select: none; margin-bottom: 2px; }
  .nav-item:hover { background: #F1F5F9; color: #1E293B; }
  .nav-item.active { background: #EBF3FF; color: ${ACCENT}; }
  .card { background: white; border-radius: 10px; border: 1px solid #E2E8F4; }
  .metric-card { background: white; border-radius: 10px; border: 1px solid #E2E8F4; padding: 16px 18px; }
  .btn-primary { background: ${ACCENT}; color: white; border: none; cursor: pointer; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; font-family: inherit; transition: background 0.15s; }
  .btn-primary:hover { background: #2D6BBD; }
  .btn-ghost { background: white; color: #475569; border: 1px solid #D1D9E6; cursor: pointer; padding: 6px 14px; border-radius: 7px; font-size: 12px; font-family: inherit; transition: all 0.15s; }
  .btn-ghost:hover { border-color: ${ACCENT}; color: ${ACCENT}; }
  .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-danger { background: white; color: #DC2626; border: 1px solid #FECACA; cursor: pointer; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-family: inherit; transition: background 0.15s; }
  .btn-danger:hover { background: #FEF2F2; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; background: #F1F5F9; color: #64748B; }
  .progress-track { height: 6px; background: #F1F5F9; border-radius: 3px; overflow: hidden; }
  .toggle { width: 32px; height: 17px; border-radius: 9px; border: none; cursor: pointer; position: relative; transition: background 0.2s; }
  .toggle-thumb { position: absolute; top: 2.5px; width: 12px; height: 12px; border-radius: 50%; background: white; transition: left 0.2s; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #94A3B8; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: center; justify-content: center; z-index: 999; }
  .modal { background: white; border-radius: 14px; padding: 24px; width: 100%; max-width: 500px; border: 1px solid #E2E8F4; max-height: 90vh; overflow-y: auto; }
  .field-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #64748B; margin-bottom: 5px; }
  .inst-row { background: white; border-radius: 10px; border: 1px solid #E2E8F4; padding: 14px 16px; transition: border-color 0.15s; }
  .inst-row:hover { border-color: #BFDBFE; }
  .goal-card { background: white; border-radius: 10px; border: 1px solid #E2E8F4; padding: 18px; transition: border-color 0.15s; }
  .goal-card:hover { border-color: #BFDBFE; }
  .empty { border: 1.5px dashed #CBD5E1; border-radius: 12px; text-align: center; padding: 40px 20px; }
  .card-filter-btn { padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #E2E8F4; background: #F8FAFC; color: #64748B; transition: all 0.15s; }
  .card-filter-btn.active { background: ${ACCENT}; color: white; border-color: ${ACCENT}; }
`;

const NAV = [
  { id: "dashboard",    label: "Dashboard",      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id: "lancamentos",  label: "Lançamentos",    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
  { id: "installments", label: "Parcelamentos",  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id: "fixed",        label: "Despesas Fixas", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { id: "goals",        label: "Metas",          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
  { id: "projecao",     label: "Projeção Anual", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [installments, setInstallments] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
  const [settings, setSettings] = useState({ monthlyIncome: 0 });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [i, f, g, s, t, b] = await Promise.all([
        load(STORAGE_KEYS.installments, []),
        load(STORAGE_KEYS.fixedExpenses, []),
        load(STORAGE_KEYS.goals, []),
        load(STORAGE_KEYS.settings, { monthlyIncome: 0 }),
        load(STORAGE_KEYS.transactions, []),
        load(STORAGE_KEYS.budgets, {}),
      ]);
      setInstallments(i); setFixedExpenses(f); setGoals(g); setSettings(s);
      setTransactions(t); setBudgets(b);
      setLoaded(true);
    })();
  }, []);

  const updInst = useCallback((v) => { setInstallments(v); save(STORAGE_KEYS.installments, v); }, []);
  const updFix = useCallback((v) => { setFixedExpenses(v); save(STORAGE_KEYS.fixedExpenses, v); }, []);
  const updGoals = useCallback((v) => { setGoals(v); save(STORAGE_KEYS.goals, v); }, []);
  const updSettings = useCallback((v) => { setSettings(v); save(STORAGE_KEYS.settings, v); }, []);
  const updTransactions = useCallback((v) => { setTransactions(v); save(STORAGE_KEYS.transactions, v); }, []);
  const updBudgets = useCallback((v) => { setBudgets(v); save(STORAGE_KEYS.budgets, v); }, []);

  const totalFixed = fixedExpenses.filter(e => e.active).reduce((s, e) => s + (e.amount || 0), 0);
  const totalInst = installments.filter(i => !i.reimbursable).reduce((s, i) => s + (i.monthlyAmount || 0), 0);
  const totalGoalsMonth = goals.reduce((s, g) => s + (g.monthlyContribution || 0), 0);
  const balance = (settings.monthlyIncome || 0) - totalFixed - totalInst - totalGoalsMonth;

  if (!loaded) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight: 320, background: BG, borderRadius: 16 }}>
      <style>{css}</style>
      <p style={{ fontSize: 13, color: "#94A3B8", letterSpacing: "0.06em" }}>Carregando...</p>
    </div>
  );

  const currentTab = NAV.find(n => n.id === tab) || { label: "Projeção Anual" };

  return (
    <div className="fe" style={{ display:"flex", minHeight: 600, background: "#E8EEF8", borderRadius: 16, overflow:"hidden", border:"1px solid #D1D9E6" }}>
      <style>{css}</style>
      <div style={{ width: SIDEBAR_W, background:"white", borderRight:"1px solid #E2E8F4", display:"flex", flexDirection:"column", flexShrink: 0 }}>
        <div style={{ padding:"20px 16px 16px", borderBottom:"1px solid #F1F5F9" }}>
          <div style={{ display:"flex", alignItems:"center", gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: ACCENT, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color:"#1E293B", letterSpacing:"-0.02em" }}>Meu<span style={{ color: ACCENT }}>Bolso</span></span>
          </div>
        </div>
        <nav style={{ padding:"12px 10px", flex: 1 }}>
          <p className="section-label" style={{ padding:"0 6px", marginBottom: 8 }}>Principal</p>
          {NAV.map(n => (
            <div key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`} onClick={() => setTab(n.id)}>
              <span style={{ opacity: tab === n.id ? 1 : 0.55 }}>{n.icon}</span>
              {n.label}
            </div>
          ))}
        </nav>
        <div style={{ padding:"12px 10px", borderTop:"1px solid #F1F5F9" }}>
          <IncomeEditor settings={settings} onSave={updSettings} />
        </div>
      </div>

      <div style={{ flex: 1, display:"flex", flexDirection:"column", minWidth: 0, background: BG }}>
        <div style={{ padding:"16px 24px", background:"white", borderBottom:"1px solid #E2E8F4", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color:"#1E293B", letterSpacing:"-0.01em" }}>{currentTab?.label}</h1>
            <p style={{ fontSize: 12, color:"#94A3B8", marginTop: 1 }}>
              {new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
            </p>
          </div>
          <div style={{ width: 34, height: 34, borderRadius:"50%", background: ACCENT, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>

        <div style={{ flex: 1, padding:"22px 24px", overflowY:"auto" }}>
          {tab === "dashboard" && <Dashboard installments={installments} fixedExpenses={fixedExpenses} goals={goals} settings={settings} totalFixed={totalFixed} totalInst={totalInst} totalGoalsMonth={totalGoalsMonth} balance={balance} transactions={transactions} />}
          {tab === "lancamentos" && <LancamentosTab transactions={transactions} onChange={updTransactions} budgets={budgets} onBudgetsChange={updBudgets} />}
          {tab === "installments" && <InstallmentsTab items={installments} onChange={updInst} />}
          {tab === "fixed" && <FixedTab items={fixedExpenses} onChange={updFix} />}
          {tab === "goals" && <GoalsTab items={goals} onChange={updGoals} />}
          {tab === "projecao" && <ProjecaoAnualTab installments={installments} fixedExpenses={fixedExpenses} goals={goals} settings={settings} />}
        </div>
      </div>
    </div>
  );
}

function IncomeEditor({ settings, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(settings.monthlyIncome || "");
  const submit = () => { onSave({ ...settings, monthlyIncome: parseFloat(val) || 0 }); setEditing(false); };
  return editing ? (
    <div>
      <p className="section-label" style={{ marginBottom: 6 }}>Renda mensal</p>
      <div style={{ display:"flex", gap: 6 }}>
        <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="0,00" autoFocus onKeyDown={e => e.key === "Enter" && submit()} style={{ flex: 1, fontSize: 12 }} />
        <button className="btn-primary" onClick={submit} style={{ padding:"6px 10px", fontSize: 12 }}>OK</button>
      </div>
    </div>
  ) : (
    <div onClick={() => { setVal(settings.monthlyIncome || ""); setEditing(true); }} className="nav-item" style={{ flexDirection:"column", alignItems:"flex-start", gap: 2, cursor:"pointer" }}>
      <p className="section-label">Renda mensal</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{fmt(settings.monthlyIncome)}</p>
      <p style={{ fontSize: 11, color:"#94A3B8" }}>clique para editar</p>
    </div>
  );
}

function MetricCard({ label, value, sub, valueColor, icon }) {
  return (
    <div className="metric-card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 10 }}>
        <p className="section-label">{label}</p>
        {icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F0F4FA", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>{icon}</div>}
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, color: valueColor || ACCENT, letterSpacing:"-0.02em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color:"#94A3B8", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

function CardBadge({ cardName }) {
  if (!cardName) return null;
  const m = CARD_META[cardName] || { color:"#888", light:"#eee", text:"#555" };
  return (
    <span className="badge" style={{ background: m.light, color: m.text, border:`1px solid ${m.color}33` }}>
      <span style={{ width: 6, height: 6, borderRadius:"50%", background: m.color, display:"inline-block", flexShrink: 0 }} />
      {cardName}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color:"#1E293B" }}>{title}</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding:"4px 10px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function CardSelector({ value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="field-label">Cartão de crédito</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap: 7 }}>
        {CREDIT_CARDS.map(c => {
          const m = CARD_META[c];
          const sel = value === c;
          return (
            <div key={c} onClick={() => onChange(sel ? "" : c)}
              style={{ cursor:"pointer", padding:"5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, transition:"all 0.15s",
                background: sel ? m.color : "#F8FAFC", color: sel ? "white" : "#64748B",
                border: sel ? `1.5px solid ${m.color}` : "1px solid #E2E8F4" }}>
              {c}
            </div>
          );
        })}
        <div onClick={() => onChange("")}
          style={{ cursor:"pointer", padding:"5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: !value ? "#EBF3FF" : "#F8FAFC", color: !value ? ACCENT : "#94A3B8",
            border: `1px solid ${!value ? ACCENT : "#E2E8F4"}`, transition:"all 0.15s" }}>
          Sem cartão
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ installments, fixedExpenses, goals, settings, totalFixed, totalInst, totalGoalsMonth, balance, transactions }) {
  const now = new Date();
  const currentMonthKey = monthKey(now);
  const monthTx = transactions.filter(t => {
    if (!t.date) return false;
    const effMonth = isCreditCard(t.payment) ? getBillingMonth(t.date, t.payment) : t.date.slice(0, 7);
    return effMonth === currentMonthKey;
  });
  const totalVariable = monthTx.reduce((s, t) => s + (t.amount || 0), 0);

  const catMap = {};
  fixedExpenses.filter(e => e.active).forEach(e => { const c = e.category || "Outros"; catMap[c] = (catMap[c] || 0) + e.amount; });
  installments.filter(i => !i.reimbursable).forEach(i => { const c = i.category || "Outros"; catMap[c] = (catMap[c] || 0) + i.monthlyAmount; });
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const cardMap = {};
  installments.filter(i => !i.reimbursable).forEach(i => { if (i.creditCard) { cardMap[i.creditCard] = (cardMap[i.creditCard] || 0) + (i.monthlyAmount || 0); } });
  const cardData = Object.entries(cardMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const totalExpenses = totalFixed + totalInst + totalGoalsMonth;
  const income = settings.monthlyIncome || 0;
  const pct = income > 0 ? Math.min(100, (totalExpenses / income) * 100) : 0;
  const upcomingEnds = installments.map(i => ({ ...i, endDate: getEndDate(i) })).filter(i => i.endDate).sort((a, b) => a.endDate - b.endDate).slice(0, 5);
  const totalGoalsSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const totalGoalsTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap: 18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap: 14 }}>
        <MetricCard label="Renda Mensal" value={fmt(income)} sub="base de cálculo" valueColor="#1E293B"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
        <MetricCard label="Despesas Fixas" value={fmt(totalFixed)} sub={`${fixedExpenses.filter(e=>e.active).length} ativas`} valueColor="#DC2626"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        <MetricCard label="Parcelamentos" value={fmt(totalInst)} sub={`${installments.filter(i=>!i.reimbursable).length} ativos`} valueColor="#D97706"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
        <MetricCard label="Variáveis (mês)" value={fmt(totalVariable)} sub={`${monthTx.length} lançamentos`} valueColor="#7C3AED" />
        <MetricCard label="Saldo Livre" value={fmt(balance - totalVariable)} sub="após todos os gastos" valueColor={(balance - totalVariable) >= 0 ? "#16A34A" : "#DC2626"}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
      </div>

      {income > 0 && (
        <div className="card" style={{ padding:"14px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 10 }}>
            <p style={{ fontWeight: 600, fontSize: 13, color:"#1E293B" }}>Orçamento comprometido</p>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct > 85 ? "#DC2626" : pct > 60 ? "#D97706" : "#16A34A" }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div style={{ height:"100%", width:`${pct}%`, background: pct > 85 ? "#DC2626" : pct > 60 ? "#F59E0B" : ACCENT, borderRadius: 3, transition:"width 0.5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop: 6 }}>
            {[{ l:"Fixas", v: totalFixed, c:"#DC2626" }, { l:"Parcelados", v: totalInst, c:"#D97706" }, { l:"Metas", v: totalGoalsMonth, c: ACCENT }, { l:"Livre", v: balance, c:"#16A34A" }].map(s => (
              <div key={s.l} style={{ textAlign:"center" }}>
                <p style={{ fontSize: 10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.l}</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{fmt(s.v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding:"16px 18px" }}>
          <p style={{ fontWeight: 600, fontSize: 13, color:"#1E293B", marginBottom: 4 }}>Gastos por categoria</p>
          <p style={{ fontSize: 11, color:"#94A3B8", marginBottom: 14 }}>fixas + parcelamentos</p>
          {pieData.length === 0
            ? <div className="empty" style={{ padding:"20px" }}><p style={{ fontSize:13, color:"#94A3B8" }}>Sem dados</p></div>
            : <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={CAT_COLORS[CATEGORIES.indexOf(d.name) % CAT_COLORS.length] || "#888"} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border:"1px solid #E2E8F4" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 12px" }}>
                {pieData.slice(0, 5).map((d, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap: 5, fontSize: 11, color:"#64748B" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[CATEGORIES.indexOf(d.name) % CAT_COLORS.length] || "#888", display:"inline-block" }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </>
          }
        </div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <p style={{ fontWeight: 600, fontSize: 13, color:"#1E293B", marginBottom: 4 }}>Parcelamentos por cartão</p>
          <p style={{ fontSize: 11, color:"#94A3B8", marginBottom: 14 }}>comprometimento mensal</p>
          {cardData.length === 0
            ? <div className="empty" style={{ padding:"20px" }}><p style={{ fontSize:13, color:"#94A3B8" }}>Nenhum cartão</p></div>
            : cardData.map((d, i) => {
              const m = CARD_META[d.name] || { color:"#888", light:"#eee", text:"#555" };
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 5 }}>
                    <CardBadge cardName={d.name} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: m.text }}>{fmt(d.value)}</span>
                  </div>
                  <div className="progress-track">
                    <div style={{ height:"100%", width:`${(d.value / cardData[0].value) * 100}%`, background: m.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding:"16px 18px" }}>
          <p style={{ fontWeight: 600, fontSize: 13, color:"#1E293B", marginBottom: 14 }}>Encerrando em breve</p>
          {upcomingEnds.length === 0
            ? <p style={{ fontSize: 13, color:"#94A3B8" }}>Nenhum parcelamento ativo</p>
            : upcomingEnds.map(i => {
              const remaining = i.totalInstallments - i.paidInstallments;
              return (
                <div key={i.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #F1F5F9" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color:"#1E293B", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{i.name}</p>
                    <div style={{ display:"flex", gap: 6, marginTop: 3, flexWrap:"wrap", alignItems:"center" }}>
                      {i.creditCard && <CardBadge cardName={i.creditCard} />}
                      <span style={{ fontSize: 11, color:"#94A3B8" }}>{remaining}x • {fmt(i.monthlyAmount)}/mês</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color:"#94A3B8", marginLeft: 10, flexShrink:0 }}>{fmtDate(i.endDate?.toISOString().split("T")[0])}</span>
                </div>
              );
            })
          }
        </div>
        <div className="card" style={{ padding:"16px 18px" }}>
          <p style={{ fontWeight: 600, fontSize: 13, color:"#1E293B", marginBottom: 14 }}>Progresso das metas</p>
          {goals.length === 0
            ? <p style={{ fontSize: 13, color:"#94A3B8" }}>Nenhuma meta</p>
            : goals.slice(0, 4).map((g, idx) => {
              const pct = Math.min(100, ((g.currentAmount || 0) / (g.targetAmount || 1)) * 100);
              const colors = [ACCENT, "#22C4A0", "#A855F7", "#F59E0B"];
              const c = colors[idx % colors.length];
              return (
                <div key={g.id} style={{ marginBottom: 14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color:"#1E293B" }}>{g.name}</span>
                    <span style={{ fontSize: 11, color:"#94A3B8" }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="progress-track">
                    <div style={{ height:"100%", width:`${pct}%`, background: c, borderRadius: 3, transition:"width 0.4s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: c, fontWeight: 600 }}>{fmt(g.currentAmount)}</span>
                    <span style={{ fontSize: 11, color:"#94A3B8" }}>{fmt(g.targetAmount)}</span>
                  </div>
                </div>
              );
            })
          }
          {totalGoalsTarget > 0 && (
            <div style={{ marginTop: 8, padding:"10px 12px", background:"#F8FAFC", borderRadius: 8, display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize: 11, color:"#64748B", fontWeight: 600 }}>Total guardado</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{fmt(totalGoalsSaved)} / {fmt(totalGoalsTarget)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PARCELAMENTOS ────────────────────────────────────────────────────────────

function InstallmentsTab({ items, onChange }) {
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [cardFilter, setCardFilter] = useState("Todos");

  const blank = () => ({ id: Date.now(), name:"", totalAmount:"", paidInstallments:0, totalInstallments:"", monthlyAmount:"", startDate:"", category:"Outros", creditCard:"", reimbursable: false, reimbursedBy:"" });
  const openAdd = () => { setEditItem(blank()); setModal("form"); };
  const openEdit = (item) => { setEditItem({ ...item }); setModal("form"); };
  const save = () => {
    if (!editItem.name) return;
    const exists = items.find(i => i.id === editItem.id);
    onChange(exists ? items.map(i => i.id === editItem.id ? editItem : i) : [...items, editItem]);
    setModal(null);
  };
  const remove = (id) => onChange(items.filter(i => i.id !== id));

  const totalMonthly = items.reduce((s, i) => s + (i.monthlyAmount || 0), 0);
  const totalMonthlyOwn = items.filter(i => !i.reimbursable).reduce((s, i) => s + (i.monthlyAmount || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.totalAmount || (i.monthlyAmount * (i.totalInstallments - i.paidInstallments)) || 0), 0);

  // Card filter options
  const usedCards = ["Todos", ...CREDIT_CARDS.filter(c => items.some(i => i.creditCard === c)), "Sem cartão"];
  const filtered = cardFilter === "Todos" ? items : cardFilter === "Sem cartão" ? items.filter(i => !i.creditCard) : items.filter(i => i.creditCard === cardFilter);

  return (
    <div>
      {/* Summary row */}
      <div style={{ display:"flex", gap: 14, marginBottom: 18, flexWrap:"wrap" }}>
        <div className="metric-card" style={{ padding:"12px 16px", flex:1, minWidth:140 }}>
          <p className="section-label" style={{ marginBottom: 4 }}>Parcelamentos</p>
          <p style={{ fontSize: 20, fontWeight: 700, color:"#1E293B" }}>{items.length}</p>
        </div>
        <div className="metric-card" style={{ padding:"12px 16px", flex:1, minWidth:160 }}>
          <p className="section-label" style={{ marginBottom: 4 }}>Total/mês (seus)</p>
          <p style={{ fontSize: 20, fontWeight: 700, color:"#D97706" }}>{fmt(totalMonthlyOwn)}</p>
          {items.some(i => i.reimbursable) && <p style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>+{fmt(totalMonthly - totalMonthlyOwn)} reembolsável</p>}
        </div>
        <div className="metric-card" style={{ padding:"12px 16px", flex:1, minWidth:180 }}>
          <p className="section-label" style={{ marginBottom: 4 }}>Valor total restante</p>
          <p style={{ fontSize: 20, fontWeight: 700, color:"#DC2626" }}>{fmt(totalValue)}</p>
          <p style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>soma de todas as parcelas restantes</p>
        </div>
        <div style={{ display:"flex", alignItems:"center" }}>
          <button className="btn-primary" onClick={openAdd}>+ Adicionar</button>
        </div>
      </div>

      {/* Card filter */}
      {usedCards.length > 2 && (
        <div style={{ display:"flex", gap: 8, flexWrap:"wrap", marginBottom: 16 }}>
          {usedCards.map(c => {
            const meta = CARD_META[c];
            const isActive = cardFilter === c;
            return (
              <button key={c} onClick={() => setCardFilter(c)}
                className="card-filter-btn"
                style={isActive && meta ? { background: meta.color, color:"white", borderColor: meta.color } : isActive ? { background: ACCENT, color:"white", borderColor: ACCENT } : {}}>
                {c}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0
        ? <div className="empty"><p style={{ fontWeight: 600, color:"#475569" }}>Nenhum parcelamento{cardFilter !== "Todos" ? ` no ${cardFilter}` : ""}</p></div>
        : (
          <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
            {filtered.map(item => {
              const m = item.creditCard ? CARD_META[item.creditCard] : null;
              const pct = Math.min(100, ((item.paidInstallments || 0) / (item.totalInstallments || 1)) * 100);
              const remaining = (item.totalInstallments || 0) - (item.paidInstallments || 0);
              const endDate = getEndDate(item);
              const barColor = m ? m.color : ACCENT;
              const remainingValue = item.monthlyAmount * remaining;
              return (
                <div key={item.id} className="inst-row" style={{ borderLeft:`3px solid ${item.reimbursable ? "#22C4A0" : barColor}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color:"#1E293B" }}>{item.name}</p>
                        {item.reimbursable && (
                          <span className="badge" style={{ background:"#ECFDF5", color:"#059669", border:"1px solid #6EE7B7", fontSize:10 }}>
                            Reembolsável{item.reimbursedBy ? ` · ${item.reimbursedBy}` : ""}
                          </span>
                        )}
                      </div>
                      <div style={{ display:"flex", gap: 6, flexWrap:"wrap", alignItems:"center" }}>
                        {item.creditCard && <CardBadge cardName={item.creditCard} />}
                        <span className="chip">{item.category}</span>
                        {endDate && <span style={{ fontSize: 11, color:"#94A3B8" }}>Termina em {fmtDate(endDate.toISOString().split("T")[0])}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0, marginLeft: 14 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: item.reimbursable ? "#22C4A0" : "#D97706" }}>{fmt(item.monthlyAmount)}<span style={{ fontSize: 11, fontWeight: 400, color:"#94A3B8" }}>/mês</span></p>
                      <p style={{ fontSize: 11, color:"#94A3B8", marginTop:2 }}>Restante: <strong style={{ color:"#DC2626" }}>{fmt(remainingValue)}</strong></p>
                      {item.totalAmount && <p style={{ fontSize: 11, color:"#94A3B8" }}>Total: {fmt(item.totalAmount)}</p>}
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize: 11, color:"#94A3B8", marginBottom: 5 }}>
                      <span>{item.paidInstallments || 0} / {item.totalInstallments || 0} pagas</span>
                      <span style={{ fontWeight: 600, color: remaining === 0 ? "#16A34A" : "#475569" }}>{remaining} restantes</span>
                    </div>
                    <div className="progress-track">
                      <div style={{ height:"100%", width:`${pct}%`, background: pct >= 100 ? "#16A34A" : (item.reimbursable ? "#22C4A0" : barColor), borderRadius: 3, transition:"width 0.4s" }} />
                    </div>
                  </div>
                  <div style={{ display:"flex", gap: 8, justifyContent:"flex-end" }}>
                    {remaining > 0 && (
                      <button className="btn-ghost" onClick={() => onChange(items.map(i => i.id === item.id ? { ...i, paidInstallments: Math.min(i.totalInstallments, (i.paidInstallments || 0) + 1) } : i))}>
                        +1 paga
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => openEdit(item)}>Editar</button>
                    <button className="btn-danger" onClick={() => remove(item.id)}>Remover</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {modal === "form" && editItem && (
        <Modal title={items.find(i => i.id === editItem.id) ? "Editar parcelamento" : "Novo parcelamento"} onClose={() => setModal(null)}>
          <Field label="Nome da compra">
            <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} placeholder="Ex: iPhone, Notebook, Geladeira..." autoFocus />
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap: 12 }}>
            <Field label="Valor total (R$)">
              <input type="number" value={editItem.totalAmount} onChange={e => setEditItem({ ...editItem, totalAmount: parseFloat(e.target.value) || "" })} placeholder="0,00" />
            </Field>
            <Field label="Valor da parcela (R$)">
              <input type="number" value={editItem.monthlyAmount} onChange={e => setEditItem({ ...editItem, monthlyAmount: parseFloat(e.target.value) || "" })} placeholder="0,00" />
            </Field>
            <Field label="Parcelas pagas">
              <input type="number" value={editItem.paidInstallments} onChange={e => setEditItem({ ...editItem, paidInstallments: parseInt(e.target.value) || 0 })} min="0" />
            </Field>
            <Field label="Total de parcelas">
              <input type="number" value={editItem.totalInstallments} onChange={e => setEditItem({ ...editItem, totalInstallments: parseInt(e.target.value) || "" })} placeholder="12" />
            </Field>
          </div>
          <Field label="Data da 1ª parcela">
            <input type="date" value={editItem.startDate || ""} onChange={e => setEditItem({ ...editItem, startDate: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <CardSelector value={editItem.creditCard || ""} onChange={v => setEditItem({ ...editItem, creditCard: v })} />

          {/* Reimbursable flag */}
          <div style={{ marginBottom: 14, padding:"12px 14px", background:"#F0FDF4", borderRadius: 8, border:"1px solid #BBF7D0" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: editItem.reimbursable ? 10 : 0 }}>
              <button className="toggle" onClick={() => setEditItem({ ...editItem, reimbursable: !editItem.reimbursable })}
                style={{ background: editItem.reimbursable ? "#16A34A" : "#CBD5E1" }}>
                <div className="toggle-thumb" style={{ left: editItem.reimbursable ? 18 : 3 }} />
              </button>
              <div>
                <p style={{ fontSize:13, fontWeight:600, color:"#1E293B" }}>Reembolsável</p>
                <p style={{ fontSize:11, color:"#64748B" }}>Esta parcela é paga por outra pessoa — não conta no seu saldo</p>
              </div>
            </div>
            {editItem.reimbursable && (
              <div>
                <label className="field-label">Quem paga?</label>
                <input value={editItem.reimbursedBy || ""} onChange={e => setEditItem({ ...editItem, reimbursedBy: e.target.value })} placeholder="Ex: Irmão, João, Empresa..." />
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap: 8, justifyContent:"flex-end", marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── DESPESAS FIXAS ───────────────────────────────────────────────────────────

function FixedTab({ items, onChange }) {
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const openAdd = () => { setEditItem({ id: Date.now(), name:"", amount:"", category:"Outros", dueDay:"", active:true, paymentMethod:"" }); setModal("form"); };
  const openEdit = (item) => { setEditItem({ ...item }); setModal("form"); };
  const save = () => {
    if (!editItem.name) return;
    const exists = items.find(i => i.id === editItem.id);
    onChange(exists ? items.map(i => i.id === editItem.id ? editItem : i) : [...items, editItem]);
    setModal(null);
  };
  const remove = (id) => onChange(items.filter(i => i.id !== id));
  const toggle = (id) => onChange(items.map(i => i.id === id ? { ...i, active: !i.active } : i));
  const total = items.filter(e => e.active).reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 18 }}>
        <div style={{ display:"flex", gap: 14 }}>
          <div className="metric-card" style={{ padding:"10px 16px" }}>
            <p className="section-label" style={{ marginBottom: 2 }}>Ativas</p>
            <p style={{ fontSize: 18, fontWeight: 700, color:"#1E293B" }}>{items.filter(e=>e.active).length}</p>
          </div>
          <div className="metric-card" style={{ padding:"10px 16px" }}>
            <p className="section-label" style={{ marginBottom: 2 }}>Total/mês</p>
            <p style={{ fontSize: 18, fontWeight: 700, color:"#DC2626" }}>{fmt(total)}</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Adicionar</button>
      </div>

      {items.length === 0
        ? <div className="empty"><p style={{ fontWeight:600, color:"#475569" }}>Nenhuma despesa fixa</p><p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>Adicione aluguel, assinaturas, contas recorrentes.</p></div>
        : (
          <div style={{ display:"flex", flexDirection:"column", gap: 8 }}>
            {items.map(item => {
              const pmColor = PM_COLOR[item.paymentMethod] || "#94A3B8";
              const cardMeta = CARD_META[item.paymentMethod];
              return (
                <div key={item.id} className="inst-row" style={{ borderLeft:`3px solid ${item.active ? "#DC2626" : "#CBD5E1"}`, opacity: item.active ? 1 : 0.55 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap: 12 }}>
                      <button className="toggle" onClick={() => toggle(item.id)} style={{ background: item.active ? "#16A34A" : "#CBD5E1" }}>
                        <div className="toggle-thumb" style={{ left: item.active ? 18 : 3 }} />
                      </button>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color:"#1E293B" }}>{item.name}</p>
                        <div style={{ display:"flex", gap: 8, marginTop: 3, flexWrap:"wrap", alignItems:"center" }}>
                          <span className="chip">{item.category}</span>
                          {item.dueDay && <span style={{ fontSize: 11, color:"#94A3B8" }}>Vence dia {item.dueDay}</span>}
                          {item.paymentMethod && (
                            cardMeta
                              ? <CardBadge cardName={item.paymentMethod} />
                              : <span className="chip" style={{ background:`${pmColor}15`, color: pmColor }}>{item.paymentMethod}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color:"#DC2626" }}>{fmt(item.amount)}</span>
                      <button className="btn-ghost" onClick={() => openEdit(item)}>Editar</button>
                      <button className="btn-danger" onClick={() => remove(item.id)}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {modal === "form" && editItem && (
        <Modal title={items.find(i => i.id === editItem.id) ? "Editar despesa" : "Nova despesa fixa"} onClose={() => setModal(null)}>
          <Field label="Nome"><input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} placeholder="Ex: Aluguel, Netflix..." autoFocus /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Valor mensal (R$)"><input type="number" value={editItem.amount} onChange={e => setEditItem({ ...editItem, amount: parseFloat(e.target.value)||"" })} placeholder="0,00" /></Field>
            <Field label="Dia do vencimento"><input type="number" value={editItem.dueDay} onChange={e => setEditItem({ ...editItem, dueDay: parseInt(e.target.value)||"" })} placeholder="5" min="1" max="31" /></Field>
          </div>
          <Field label="Categoria">
            <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">Forma de pagamento</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:4 }}>
              {FIXED_PAYMENT_METHODS.map(pm => {
                const sel = editItem.paymentMethod === pm;
                const col = PM_COLOR[pm] || "#888";
                const cardM = CARD_META[pm];
                return (
                  <div key={pm} onClick={() => setEditItem({ ...editItem, paymentMethod: sel ? "" : pm })}
                    style={{ cursor:"pointer", padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, transition:"all 0.15s",
                      background: sel ? (cardM ? cardM.color : col) : "#F8FAFC",
                      color: sel ? "white" : "#64748B",
                      border: sel ? `1.5px solid ${cardM ? cardM.color : col}` : "1px solid #E2E8F4" }}>
                    {pm}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── METAS ────────────────────────────────────────────────────────────────────

function GoalsTab({ items, onChange }) {
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [depositId, setDepositId] = useState(null);
  const [depositVal, setDepositVal] = useState("");

  const openAdd = () => { setEditItem({ id: Date.now(), name:"", targetAmount:"", currentAmount:0, monthlyContribution:"", deadline:"", category:"Outros" }); setModal("form"); };
  const openEdit = (item) => { setEditItem({ ...item }); setModal("form"); };
  const save = () => {
    if (!editItem.name) return;
    const exists = items.find(i => i.id === editItem.id);
    onChange(exists ? items.map(i => i.id === editItem.id ? editItem : i) : [...items, editItem]);
    setModal(null);
  };
  const remove = (id) => onChange(items.filter(i => i.id !== id));
  const deposit = (id) => {
    const v = parseFloat(depositVal);
    if (!v) return;
    onChange(items.map(i => i.id === id ? { ...i, currentAmount: Math.min(i.targetAmount||999999, (i.currentAmount||0)+v) } : i));
    setDepositId(null); setDepositVal("");
  };

  const GOAL_COLORS = [ACCENT, "#22C4A0", "#A855F7", "#F59E0B", "#EC4899", "#F5734A"];
  const totalGoalsSaved = items.reduce((s, g) => s + (g.currentAmount || 0), 0);
  const totalGoalsTarget = items.reduce((s, g) => s + (g.targetAmount || 0), 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 18 }}>
        <div style={{ display:"flex", gap: 14 }}>
          <div className="metric-card" style={{ padding:"10px 16px" }}>
            <p className="section-label" style={{ marginBottom: 2 }}>Metas</p>
            <p style={{ fontSize: 18, fontWeight: 700, color:"#1E293B" }}>{items.length}</p>
          </div>
          <div className="metric-card" style={{ padding:"10px 16px" }}>
            <p className="section-label" style={{ marginBottom: 2 }}>Total guardado</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: ACCENT }}>{fmt(totalGoalsSaved)}</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Nova meta</button>
      </div>

      {items.length === 0
        ? <div className="empty"><p style={{ fontWeight:600, color:"#475569" }}>Nenhuma meta cadastrada</p><p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>Defina objetivos de poupança e acompanhe o progresso.</p></div>
        : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(270px, 1fr))", gap:14 }}>
            {items.map((item, idx) => {
              const pct = Math.min(100, ((item.currentAmount||0) / (item.targetAmount||1)) * 100);
              const remaining = (item.targetAmount||0) - (item.currentAmount||0);
              const c = GOAL_COLORS[idx % GOAL_COLORS.length];
              return (
                <div key={item.id} className="goal-card" style={{ borderTop:`3px solid ${c}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color:"#1E293B" }}>{item.name}</p>
                      <span className="chip" style={{ marginTop: 4, display:"inline-block" }}>{item.category}</span>
                    </div>
                    {pct >= 100 && <span className="badge" style={{ background:"#F0FDF4", color:"#16A34A", border:"1px solid #86EFAC" }}>Concluída</span>}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: c }}>{fmt(item.currentAmount)}</span>
                      <span style={{ fontSize: 12, color:"#94A3B8" }}>/ {fmt(item.targetAmount)}</span>
                    </div>
                    <div className="progress-track" style={{ height: 8 }}>
                      <div style={{ height:"100%", width:`${pct}%`, background: c, borderRadius: 4, transition:"width 0.4s" }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, color:"#94A3B8" }}>{pct.toFixed(0)}% atingido</span>
                      {remaining > 0 && <span style={{ fontSize: 11, color:"#94A3B8" }}>{fmt(remaining)} faltando</span>}
                    </div>
                  </div>
                  {item.monthlyContribution > 0 && (
                    <div style={{ background:"#F8FAFC", borderRadius: 8, padding:"8px 12px", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color:"#64748B" }}>Guardando <strong style={{ color:"#1E293B" }}>{fmt(item.monthlyContribution)}/mês</strong></span>
                      {item.deadline && <span style={{ fontSize: 11, color:"#94A3B8", marginLeft: 8 }}>até {fmtDate(item.deadline)}</span>}
                    </div>
                  )}
                  {depositId === item.id && (
                    <div style={{ display:"flex", gap: 8, marginBottom: 10 }}>
                      <input type="number" value={depositVal} onChange={e => setDepositVal(e.target.value)} placeholder="Valor (R$)" autoFocus onKeyDown={e => e.key === "Enter" && deposit(item.id)} />
                      <button className="btn-primary" onClick={() => deposit(item.id)} style={{ padding:"7px 14px" }}>OK</button>
                      <button className="btn-ghost" onClick={() => setDepositId(null)} style={{ padding:"7px 10px" }}>✕</button>
                    </div>
                  )}
                  <div style={{ display:"flex", gap: 8, justifyContent:"flex-end" }}>
                    {pct < 100 && <button className="btn-ghost" onClick={() => { setDepositId(item.id); setDepositVal(""); }}>+ Guardar</button>}
                    <button className="btn-ghost" onClick={() => openEdit(item)}>Editar</button>
                    <button className="btn-danger" onClick={() => remove(item.id)}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      }

      {modal === "form" && editItem && (
        <Modal title={items.find(i => i.id === editItem.id) ? "Editar meta" : "Nova meta"} onClose={() => setModal(null)}>
          <Field label="Nome da meta"><input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} placeholder="Ex: Viagem para Europa, Reserva..." autoFocus /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Valor alvo (R$)"><input type="number" value={editItem.targetAmount} onChange={e => setEditItem({ ...editItem, targetAmount: parseFloat(e.target.value)||"" })} placeholder="0,00" /></Field>
            <Field label="Já guardado (R$)"><input type="number" value={editItem.currentAmount} onChange={e => setEditItem({ ...editItem, currentAmount: parseFloat(e.target.value)||0 })} placeholder="0,00" /></Field>
          </div>
          <Field label="Contribuição mensal (R$)"><input type="number" value={editItem.monthlyContribution} onChange={e => setEditItem({ ...editItem, monthlyContribution: parseFloat(e.target.value)||"" })} placeholder="Quanto guardar por mês" /></Field>
          <Field label="Prazo (opcional)"><input type="date" value={editItem.deadline||""} onChange={e => setEditItem({ ...editItem, deadline: e.target.value })} /></Field>
          <Field label="Categoria">
            <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── LANÇAMENTOS ──────────────────────────────────────────────────────────────

function getEffectiveMonth(tx) {
  if (!tx.date) return null;
  if (isCreditCard(tx.payment)) return getBillingMonth(tx.date, tx.payment);
  return tx.date.slice(0, 7);
}

function LancamentosTab({ transactions, onChange, budgets, onBudgetsChange }) {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(monthKey(now));
  const [showForm, setShowForm] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [editingTx, setEditingTx] = useState(null);

  const blankTx = () => ({
    id: Date.now(), name:"", amount:"", category:"Alimentação",
    date: new Date().toISOString().split("T")[0], payment:"Débito", note:""
  });

  const allMonths = [...new Set([monthKey(now), ...transactions.map(t => getEffectiveMonth(t)).filter(Boolean)])].sort().reverse();
  const monthTx = transactions.filter(t => getEffectiveMonth(t) === selMonth).sort((a, b) => b.date.localeCompare(a.date));
  const totalMonth = monthTx.reduce((s, t) => s + (t.amount || 0), 0);

  const byCat = {};
  monthTx.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (t.amount || 0); });
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const byPM = {};
  monthTx.forEach(t => { byPM[t.payment] = (byPM[t.payment] || 0) + (t.amount || 0); });

  // Group by day (purchase date)
  const byDay = {};
  monthTx.forEach(t => { byDay[t.date] = [...(byDay[t.date] || []), t]; });
  const days = Object.keys(byDay).sort().reverse();

  const saveTx = (tx) => {
    const exists = transactions.find(t => t.id === tx.id);
    onChange(exists ? transactions.map(t => t.id === tx.id ? tx : t) : [...transactions, tx]);
    setShowForm(false); setEditingTx(null);
  };
  const removeTx = (id) => onChange(transactions.filter(t => t.id !== id));

  const navMonth = (dir) => {
    const d = parseMonthKey(selMonth);
    d.setMonth(d.getMonth() + dir);
    setSelMonth(monthKey(d));
  };

  // Credit vs cash split
  const creditTotal = monthTx.filter(t => isCreditCard(t.payment)).reduce((s, t) => s + (t.amount || 0), 0);
  const cashTotal = monthTx.filter(t => !isCreditCard(t.payment)).reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Top bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button className="btn-ghost" onClick={() => navMonth(-1)} style={{ padding:"6px 12px", fontWeight:700 }}>‹</button>
          <div style={{ minWidth:200, textAlign:"center" }}>
            <p style={{ fontSize:15, fontWeight:700, color:"#1E293B", textTransform:"capitalize" }}>{labelMonth(selMonth)}</p>
            <p style={{ fontSize:11, color:"#94A3B8" }}>{monthTx.length} lançamento{monthTx.length !== 1 ? "s" : ""} · {fmt(totalMonth)}</p>
            {isCreditCard("Nubank") && creditTotal > 0 && (
              <p style={{ fontSize:10, color:"#7C3AED" }}>Fatura: {fmt(creditTotal)} · Débito/Pix: {fmt(cashTotal)}</p>
            )}
          </div>
          <button className="btn-ghost" onClick={() => navMonth(1)} style={{ padding:"6px 12px", fontWeight:700 }} disabled={selMonth >= monthKey(now)}>›</button>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" onClick={() => setShowBudgets(!showBudgets)} style={{ fontSize:12 }}>
            {showBudgets ? "Fechar orçamentos" : "Orçamento por categoria"}
          </button>
          <button className="btn-primary" onClick={() => { setEditingTx(blankTx()); setShowForm(true); }}>+ Lançamento</button>
        </div>
      </div>

      {showBudgets && (
        <BudgetPanel budgets={budgets} onSave={onBudgetsChange} catList={catList} totalMonth={totalMonth} />
      )}

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14 }}>
        <div className="metric-card">
          <p className="section-label" style={{ marginBottom:8 }}>Total gasto</p>
          <p style={{ fontSize:20, fontWeight:700, color:"#7C3AED", letterSpacing:"-0.02em" }}>{fmt(totalMonth)}</p>
          <p style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>{monthTx.length} lançamentos</p>
        </div>
        <div className="metric-card">
          <p className="section-label" style={{ marginBottom:8 }}>No cartão (fatura)</p>
          <p style={{ fontSize:20, fontWeight:700, color:"#DC2626", letterSpacing:"-0.02em" }}>{fmt(creditTotal)}</p>
          <p style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>pago na fatura</p>
        </div>
        <div className="metric-card">
          <p className="section-label" style={{ marginBottom:8 }}>Débito / Pix / Dinheiro</p>
          <p style={{ fontSize:20, fontWeight:700, color:"#16A34A", letterSpacing:"-0.02em" }}>{fmt(cashTotal)}</p>
          <p style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>saiu da conta</p>
        </div>
        <div className="metric-card">
          <p className="section-label" style={{ marginBottom:8 }}>Maior categoria</p>
          {catList.length > 0 ? <>
            <p style={{ fontSize:16, fontWeight:700, color:"#1E293B" }}>{catList[0][0]}</p>
            <p style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>{fmt(catList[0][1])} · {totalMonth > 0 ? ((catList[0][1] / totalMonth) * 100).toFixed(0) : 0}%</p>
          </> : <p style={{ fontSize:13, color:"#94A3B8" }}>—</p>}
        </div>
      </div>

      {/* Breakdowns */}
      {catList.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div className="card" style={{ padding:"14px 18px" }}>
            <p style={{ fontWeight:700, fontSize:13, color:"#1E293B", marginBottom:12 }}>Por categoria</p>
            {catList.map(([cat, val]) => {
              const pct = totalMonth > 0 ? (val / totalMonth) * 100 : 0;
              const budget = budgets[cat];
              const over = budget && val > parseFloat(budget);
              const catColor = CAT_COLORS[CATEGORIES.indexOf(cat) % CAT_COLORS.length] || "#888";
              return (
                <div key={cat} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:catColor, display:"inline-block" }} />
                      <span style={{ fontSize:12, color:"#475569", fontWeight:500 }}>{cat}</span>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <span style={{ fontSize:12, fontWeight:700, color: over ? "#DC2626" : "#1E293B" }}>{fmt(val)}</span>
                      {budget && <span style={{ fontSize:10, color: over ? "#DC2626" : "#94A3B8", marginLeft:4 }}>/ {fmt(parseFloat(budget))}</span>}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div style={{ height:"100%", width:`${Math.min(100, pct)}%`, background: over ? "#DC2626" : catColor, borderRadius:3 }} />
                  </div>
                  {over && <p style={{ fontSize:10, color:"#DC2626", marginTop:2, fontWeight:600 }}>Estourou {fmt(val - parseFloat(budget))} acima</p>}
                </div>
              );
            })}
          </div>
          <div className="card" style={{ padding:"14px 18px" }}>
            <p style={{ fontWeight:700, fontSize:13, color:"#1E293B", marginBottom:12 }}>Por forma de pagamento</p>
            {Object.entries(byPM).sort((a, b) => b[1] - a[1]).map(([pm, val]) => {
              const pct = totalMonth > 0 ? (val / totalMonth) * 100 : 0;
              const c = PM_COLOR[pm] || "#888";
              return (
                <div key={pm} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#475569", fontWeight:500 }}>{pm}</span>
                    <div>
                      <span style={{ fontSize:12, fontWeight:700, color:c }}>{fmt(val)}</span>
                      <span style={{ fontSize:10, color:"#94A3B8", marginLeft:4 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction list */}
      {days.length === 0 ? (
        <div className="empty">
          <p style={{ fontWeight:600, color:"#475569" }}>Nenhum lançamento em {labelMonth(selMonth)}</p>
          <p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>Clique em "+ Lançamento" para registrar um gasto.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          <div style={{ padding:"13px 18px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between" }}>
            <p style={{ fontWeight:700, fontSize:13, color:"#1E293B" }}>Histórico</p>
            <p style={{ fontSize:12, color:"#94A3B8" }}>Total: <strong style={{ color:"#7C3AED" }}>{fmt(totalMonth)}</strong></p>
          </div>
          {days.map((day, di) => {
            const dayTxs = byDay[day];
            const dayTotal = dayTxs.reduce((s, t) => s + (t.amount || 0), 0);
            const [y, m, d] = day.split("-").map(Number);
            const label = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday:"short", day:"numeric", month:"short" });
            return (
              <div key={day} style={{ borderBottom: di < days.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 18px", background:"#F8FAFC" }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"capitalize" }}>{label}</p>
                  <p style={{ fontSize:11, fontWeight:700, color:"#64748B" }}>{fmt(dayTotal)}</p>
                </div>
                {dayTxs.map((tx, ti) => {
                  const catColor = CAT_COLORS[CATEGORIES.indexOf(tx.category) % CAT_COLORS.length] || "#888";
                  const pmColor = PM_COLOR[tx.payment] || "#888";
                  const billingLabel = isCreditCard(tx.payment) ? getBillingLabel(tx.date, tx.payment) : null;
                  return (
                    <div key={tx.id} style={{ display:"flex", alignItems:"center", padding:"10px 18px", borderBottom: ti < dayTxs.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:`${catColor}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginRight:12 }}>
                        <span style={{ width:10, height:10, borderRadius:"50%", background:catColor, display:"inline-block" }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:"#1E293B" }}>{tx.name}</p>
                        <div style={{ display:"flex", gap:6, marginTop:2, flexWrap:"wrap", alignItems:"center" }}>
                          <span className="chip" style={{ background:`${catColor}15`, color:catColor }}>{tx.category}</span>
                          <span className="chip" style={{ background:`${pmColor}15`, color:pmColor }}>{tx.payment}</span>
                          {billingLabel && <span className="chip" style={{ background:"#F5F3FF", color:"#6D28D9" }}>{billingLabel}</span>}
                          {tx.note && <span style={{ fontSize:11, color:"#94A3B8", fontStyle:"italic" }}>{tx.note}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginLeft:12 }}>
                        <p style={{ fontSize:15, fontWeight:700, color:"#7C3AED", whiteSpace:"nowrap" }}>{fmt(tx.amount)}</p>
                        <button className="btn-ghost" onClick={() => { setEditingTx({ ...tx }); setShowForm(true); }} style={{ padding:"4px 10px", fontSize:11 }}>Editar</button>
                        <button className="btn-danger" onClick={() => removeTx(tx.id)} style={{ padding:"4px 10px", fontSize:11 }}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {showForm && editingTx && (
        <TxModal tx={editingTx} onChange={setEditingTx} onSave={saveTx} onClose={() => { setShowForm(false); setEditingTx(null); }} />
      )}
    </div>
  );
}

function TxModal({ tx, onChange, onSave, onClose }) {
  const set = (k, v) => onChange({ ...tx, [k]: v });
  const valid = tx.name && tx.amount > 0;
  const billingInfo = isCreditCard(tx.payment) && tx.date ? getBillingLabel(tx.date, tx.payment) : null;
  const dueDay = CARD_DUE[tx.payment];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:480 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"#1E293B" }}>{tx._saved ? "Editar lançamento" : "Novo lançamento"}</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding:"4px 10px" }}>✕</button>
        </div>

        <div style={{ marginBottom:13 }}>
          <label className="field-label">Descrição</label>
          <input value={tx.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Mercado, Uber, Farmácia..." autoFocus />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:13 }}>
          <div>
            <label className="field-label">Valor (R$)</label>
            <input type="number" value={tx.amount} onChange={e => set("amount", parseFloat(e.target.value) || "")} placeholder="0,00" />
          </div>
          <div>
            <label className="field-label">Data da compra</label>
            <input type="date" value={tx.date} onChange={e => set("date", e.target.value)} />
          </div>
        </div>

        {/* Billing info banner */}
        {billingInfo && (
          <div style={{ marginBottom:13, padding:"10px 14px", background:"#F5F3FF", borderRadius:8, border:"1px solid #DDD6FE" }}>
            <p style={{ fontSize:12, fontWeight:600, color:"#6D28D9" }}>{billingInfo} {dueDay ? `· vence dia ${dueDay}` : ""}</p>
            <p style={{ fontSize:11, color:"#7C3AED", marginTop:2 }}>Compra em {tx.date ? fmtDate(tx.date) : "?"} cai nesta fatura automaticamente</p>
          </div>
        )}

        <div style={{ marginBottom:13 }}>
          <label className="field-label">Categoria</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {CATEGORIES.map(c => {
              const sel = tx.category === c;
              const col = CAT_COLORS[CATEGORIES.indexOf(c) % CAT_COLORS.length] || "#888";
              return (
                <div key={c} onClick={() => set("category", c)} style={{ cursor:"pointer", padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:600, transition:"all 0.12s",
                  background: sel ? col : "#F8FAFC", color: sel ? "white" : "#64748B",
                  border: sel ? `1.5px solid ${col}` : "1px solid #E2E8F4" }}>
                  {c}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom:13 }}>
          <label className="field-label">Forma de pagamento</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {PAYMENT_METHODS.map(pm => {
              const sel = tx.payment === pm;
              const col = PM_COLOR[pm] || "#888";
              const cardM = CARD_META[pm];
              return (
                <div key={pm} onClick={() => set("payment", pm)} style={{ cursor:"pointer", padding:"4px 11px", borderRadius:20, fontSize:11, fontWeight:600, transition:"all 0.12s",
                  background: sel ? (cardM ? cardM.color : col) : "#F8FAFC",
                  color: sel ? "white" : "#64748B",
                  border: sel ? `1.5px solid ${cardM ? cardM.color : col}` : "1px solid #E2E8F4" }}>
                  {pm}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom:18 }}>
          <label className="field-label">Observação (opcional)</label>
          <input value={tx.note || ""} onChange={e => set("note", e.target.value)} placeholder="Qualquer detalhe extra..." />
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => valid && onSave({ ...tx, _saved: true })} style={{ opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "not-allowed" }}>
            Salvar lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

function BudgetPanel({ budgets, onSave, catList, totalMonth }) {
  const [local, setLocal] = useState({ ...budgets });
  return (
    <div className="card" style={{ padding:"16px 18px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <p style={{ fontWeight:700, fontSize:13, color:"#1E293B" }}>Orçamento por categoria</p>
          <p style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>Defina limites mensais para cada categoria</p>
        </div>
        <button className="btn-primary" onClick={() => onSave(local)} style={{ padding:"7px 16px", fontSize:12 }}>Salvar</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
        {CATEGORIES.map(cat => {
          const spent = catList.find(c => c[0] === cat)?.[1] || 0;
          const budget = local[cat] || "";
          const over = budget && spent > parseFloat(budget);
          const col = CAT_COLORS[CATEGORIES.indexOf(cat) % CAT_COLORS.length] || "#888";
          return (
            <div key={cat} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 12px", border: over ? "1px solid #FECACA" : "1px solid #F1F5F9" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6 }}>
                <span style={{ width:7, height:7, borderRadius:2, background:col, display:"inline-block" }} />
                <p style={{ fontSize:11, fontWeight:600, color:"#475569" }}>{cat}</p>
              </div>
              <input type="number" value={budget} onChange={e => setLocal({ ...local, [cat]: e.target.value })} placeholder="Sem limite" style={{ fontSize:12, padding:"5px 8px", marginBottom:4 }} />
              {spent > 0 && <p style={{ fontSize:10, color: over ? "#DC2626" : "#94A3B8" }}>Gasto: {fmt(spent)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PROJEÇÃO ANUAL ────────────────────────────────────────────────────────────

function buildProjection(installments, fixedExpenses, goals, settings) {
  const now = new Date();
  const income = settings.monthlyIncome || 0;
  const totalFixed = fixedExpenses.filter(e => e.active).reduce((s, e) => s + (e.amount || 0), 0);
  const totalGoals = goals.reduce((s, g) => s + (g.monthlyContribution || 0), 0);
  let cumulative = 0;
  return Array.from({ length: 12 }, (_, m) => {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const label = `${MONTH_PT[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
    const fullLabel = `${MONTH_PT[date.getMonth()]} de ${date.getFullYear()}`;
    const activeInst = installments.filter(i => !i.reimbursable && m < ((i.totalInstallments || 0) - (i.paidInstallments || 0)));
    const instCost = activeInst.reduce((s, i) => s + (i.monthlyAmount || 0), 0);
    const ending = installments.filter(i => {
      const rem = (i.totalInstallments || 0) - (i.paidInstallments || 0);
      return rem > 0 && rem === m + 1;
    });
    const totalExpenses = totalFixed + instCost + totalGoals;
    const balance = income - totalExpenses;
    cumulative += balance;
    return { m, label, fullLabel, income, totalFixed, instCost, totalGoals, totalExpenses, balance, cumulative, activeInst, ending };
  });
}

function ProjecaoAnualTab({ installments, fixedExpenses, goals, settings }) {
  const [expanded, setExpanded] = useState(null);
  const months = buildProjection(installments, fixedExpenses, goals, settings);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.totalExpenses, 0);
  const totalBalance = months.reduce((s, m) => s + m.balance, 0);
  const instSavings = Math.max(0, months[0].instCost - months[11].instCost);

  const chartData = months.map(m => ({
    name: m.label,
    Renda: Math.round(m.income),
    Despesas: Math.round(m.totalExpenses),
    Saldo: Math.round(m.balance),
    Acumulado: Math.round(m.cumulative),
  }));

  const hasData = settings.monthlyIncome > 0 || fixedExpenses.length > 0 || installments.length > 0;
  if (!hasData) return (
    <div className="empty" style={{ marginTop: 24 }}>
      <p style={{ fontWeight:600, color:"#475569" }}>Nenhum dado para projetar</p>
      <p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>Configure sua renda, despesas fixas e parcelamentos primeiro.</p>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap: 18 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap: 14 }}>
        {[
          { label:"Renda total (12m)", value: fmt(totalIncome), sub:`${fmt(settings.monthlyIncome)}/mês`, color:"#1E293B" },
          { label:"Total de despesas", value: fmt(totalExpenses), sub:`${fmt(totalExpenses/12)}/mês (média)`, color:"#DC2626" },
          { label:"Saldo acumulado", value: fmt(totalBalance), sub: totalBalance >= 0 ? "resultado positivo" : "resultado negativo", color: totalBalance >= 0 ? "#16A34A" : "#DC2626" },
          { label:"Alívio em parcelas", value: instSavings > 0 ? fmt(instSavings) : "R$ 0,00", sub:"redução no 12º mês vs hoje", color:"#22C4A0" },
        ].map(c => (
          <div key={c.label} className="metric-card">
            <p className="section-label" style={{ marginBottom: 8 }}>{c.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: c.color, letterSpacing:"-0.02em" }}>{c.value}</p>
            <p style={{ fontSize: 11, color:"#94A3B8", marginTop: 3 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding:"18px 20px" }}>
        <p style={{ fontWeight: 700, fontSize: 14, color:"#1E293B", marginBottom: 3 }}>Saldo × Despesas — próximos 12 meses</p>
        <p style={{ fontSize: 11, color:"#94A3B8", marginBottom: 16 }}>As despesas encolhem conforme os parcelamentos se encerram</p>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill:"#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill:"#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} width={50} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border:"1px solid #E2E8F4" }} formatter={(v, n) => [fmt(v), n]} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
            <Bar dataKey="Renda" fill="#DBEAFE" radius={[4,4,0,0]} barSize={16} />
            <Bar dataKey="Despesas" fill="#FEE2E2" radius={[4,4,0,0]} barSize={16} />
            <Line type="monotone" dataKey="Saldo" stroke="#16A34A" strokeWidth={2.5} dot={{ r:3, fill:"#16A34A", strokeWidth:0 }} />
            <Line type="monotone" dataKey="Acumulado" stroke="#4080D0" strokeWidth={2} strokeDasharray="5 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 18px 12px", borderBottom:"1px solid #F1F5F9" }}>
          <p style={{ fontWeight: 700, fontSize: 14, color:"#1E293B" }}>Detalhamento mês a mês</p>
          <p style={{ fontSize: 11, color:"#94A3B8", marginTop: 2 }}>Clique em qualquer mês para ver o detalhamento completo</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"148px 88px 88px 108px 88px 108px 108px 98px 22px", padding:"9px 18px", background:"#F8FAFC", borderBottom:"1px solid #F1F5F9" }}>
          {["Mês","Renda","Fixas","Parcelamentos","Metas","Total Desp.","Resultado","Acumulado",""].map((h,i) => (
            <p key={i} className="section-label" style={{ textAlign: i > 0 && i < 8 ? "right" : "left" }}>{h}</p>
          ))}
        </div>
        {months.map((m, idx) => {
          const isPos = m.balance >= 0;
          const isCurr = idx === 0;
          const isExp = expanded === idx;
          const prevInst = idx > 0 ? months[idx-1].instCost : m.instCost;
          const instDrop = prevInst - m.instCost;
          return (
            <div key={idx}>
              <div onClick={() => setExpanded(isExp ? null : idx)} style={{
                display:"grid", gridTemplateColumns:"148px 88px 88px 108px 88px 108px 108px 98px 22px",
                padding:"11px 18px", cursor:"pointer",
                background: isCurr ? "#FAFBFF" : isExp ? "#F8FAFC" : "white",
                borderBottom: idx < 11 ? "1px solid #F8FAFC" : "none", transition:"background 0.12s",
              }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {isCurr && <span style={{ width:6, height:6, borderRadius:"50%", background:"#4080D0", display:"inline-block", flexShrink:0 }} />}
                    <p style={{ fontSize:13, fontWeight: isCurr ? 700 : 500, color:"#1E293B" }}>{m.fullLabel}</p>
                  </div>
                  {m.ending.length > 0 && <p style={{ fontSize:10, color:"#D97706", fontWeight:600, marginTop:1 }}>{m.ending.length}x encerra{m.ending.length>1?"m":""}</p>}
                  {instDrop > 0 && idx > 0 && <p style={{ fontSize:10, color:"#22C4A0", fontWeight:600, marginTop:1 }}>↓ {fmt(instDrop)} liberado</p>}
                </div>
                <p style={{ fontSize:12, fontWeight:500, color:"#1E293B", textAlign:"right", alignSelf:"center" }}>{fmt(m.income)}</p>
                <p style={{ fontSize:12, color:"#DC2626", textAlign:"right", alignSelf:"center" }}>{fmt(m.totalFixed)}</p>
                <p style={{ fontSize:12, color:"#D97706", textAlign:"right", alignSelf:"center" }}>{fmt(m.instCost)}</p>
                <p style={{ fontSize:12, color:"#4080D0", textAlign:"right", alignSelf:"center" }}>{fmt(m.totalGoals)}</p>
                <p style={{ fontSize:12, fontWeight:600, color:"#475569", textAlign:"right", alignSelf:"center" }}>{fmt(m.totalExpenses)}</p>
                <div style={{ textAlign:"right", alignSelf:"center" }}>
                  <span style={{ fontSize:12, fontWeight:700, color: isPos?"#16A34A":"#DC2626", background: isPos?"#F0FDF4":"#FEF2F2", padding:"2px 9px", borderRadius:20 }}>
                    {isPos?"+":""}{fmt(m.balance)}
                  </span>
                </div>
                <p style={{ fontSize:12, fontWeight:600, color: m.cumulative>=0?"#16A34A":"#DC2626", textAlign:"right", alignSelf:"center" }}>{fmt(m.cumulative)}</p>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", color:"#CBD5E1", fontSize:10, transform: isExp?"rotate(180deg)":"none", transition:"transform 0.15s" }}>▼</div>
              </div>
              {isExp && (
                <div style={{ background:"#F8FAFC", borderTop:"1px solid #F1F5F9", borderBottom: idx<11?"1px solid #E2E8F4":"none", padding:"14px 20px 16px 36px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 32px" }}>
                    <div>
                      <p className="section-label" style={{ marginBottom:8 }}>Despesas fixas</p>
                      {fixedExpenses.filter(e=>e.active).length === 0
                        ? <p style={{ fontSize:12, color:"#94A3B8" }}>Nenhuma</p>
                        : fixedExpenses.filter(e=>e.active).map(e => (
                          <div key={e.id} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #F1F5F9" }}>
                            <span style={{ fontSize:12, color:"#475569" }}>{e.name}</span>
                            <span style={{ fontSize:12, fontWeight:500, color:"#DC2626" }}>{fmt(e.amount)}</span>
                          </div>
                        ))
                      }
                    </div>
                    <div>
                      <p className="section-label" style={{ marginBottom:8 }}>
                        Parcelas ativas — {m.activeInst.length}
                        {m.ending.length > 0 && <span style={{ marginLeft:8, color:"#D97706" }}>· {m.ending.length} encerra{m.ending.length>1?"m":""} aqui</span>}
                      </p>
                      {m.activeInst.length === 0
                        ? <p style={{ fontSize:12, color:"#94A3B8" }}>Nenhum</p>
                        : m.activeInst.map(i => {
                          const rem = (i.totalInstallments||0) - (i.paidInstallments||0) - m.m;
                          const isLast = m.ending.some(e => e.id === i.id);
                          return (
                            <div key={i.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #F1F5F9" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                {isLast && <span style={{ fontSize:9, fontWeight:700, color:"#D97706", background:"#FFFBEB", border:"1px solid #FDE68A", padding:"1px 5px", borderRadius:8 }}>ÚLTIMA</span>}
                                <span style={{ fontSize:12, color:"#475569" }}>{i.name}</span>
                                {i.creditCard && <span style={{ fontSize:10, color:"#94A3B8" }}>· {i.creditCard}</span>}
                              </div>
                              <div style={{ textAlign:"right" }}>
                                <span style={{ fontSize:12, fontWeight:500, color:"#D97706" }}>{fmt(i.monthlyAmount)}</span>
                                <span style={{ fontSize:10, color:"#94A3B8", marginLeft:4 }}>{Math.max(0,rem)}x rest.</span>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                  <div style={{ marginTop:12, display:"flex", gap:20, padding:"10px 14px", background:"white", borderRadius:8, border:"1px solid #E2E8F4" }}>
                    {[
                      { l:"Renda", v:m.income, c:"#1E293B" },
                      { l:"Fixas", v:m.totalFixed, c:"#DC2626" },
                      { l:"Parcelas", v:m.instCost, c:"#D97706" },
                      { l:"Metas", v:m.totalGoals, c:"#4080D0" },
                      { l:"Resultado", v:m.balance, c: isPos?"#16A34A":"#DC2626" },
                      { l:"Acumulado", v:m.cumulative, c: m.cumulative>=0?"#16A34A":"#DC2626" },
                    ].map(s => (
                      <div key={s.l}>
                        <p className="section-label" style={{ marginBottom:2 }}>{s.l}</p>
                        <p style={{ fontSize:13, fontWeight:700, color:s.c }}>{s.v>=0?"":"-"}{fmt(Math.abs(s.v))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ display:"grid", gridTemplateColumns:"148px 88px 88px 108px 88px 108px 108px 98px 22px", padding:"12px 18px", background:"#EEF2F8", borderTop:"2px solid #D1D9E6" }}>
          <p style={{ fontSize:12, fontWeight:700, color:"#1E293B" }}>TOTAL 12 MESES</p>
          <p style={{ fontSize:12, fontWeight:700, color:"#1E293B", textAlign:"right" }}>{fmt(totalIncome)}</p>
          <p style={{ fontSize:12, fontWeight:700, color:"#DC2626", textAlign:"right" }}>{fmt(months.reduce((s,m)=>s+m.totalFixed,0))}</p>
          <p style={{ fontSize:12, fontWeight:700, color:"#D97706", textAlign:"right" }}>{fmt(months.reduce((s,m)=>s+m.instCost,0))}</p>
          <p style={{ fontSize:12, fontWeight:700, color:"#4080D0", textAlign:"right" }}>{fmt(months.reduce((s,m)=>s+m.totalGoals,0))}</p>
          <p style={{ fontSize:12, fontWeight:700, color:"#475569", textAlign:"right" }}>{fmt(totalExpenses)}</p>
          <p style={{ fontSize:12, fontWeight:700, color: totalBalance>=0?"#16A34A":"#DC2626", textAlign:"right" }}>{totalBalance>=0?"+":""}{fmt(totalBalance)}</p>
          <p style={{ fontSize:12, fontWeight:700, color: totalBalance>=0?"#16A34A":"#DC2626", textAlign:"right" }}>{fmt(totalBalance)}</p>
          <div />
        </div>
      </div>
    </div>
  );
}
