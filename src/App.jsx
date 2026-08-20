import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, LogOut, Plus, Minus,
  Trash2, Pencil, Search, X, User, Lock, AlertTriangle,
  TrendingUp, Receipt, Check, UserPlus
} from 'lucide-react';

// ============================================================
// Constants & seed data
// ============================================================
const SHOP_NAME = ['Happy Sips'];
const UNITS = ['kg', 'g', 'L', 'ml', 'pc'];
const INVENTORY_CATEGORIES = ['Ingredient', 'Supplies'];
const MENU_CATEGORIES = ['Milk Tea', 'Fruit Tea', 'Fruit Soda'];
const PAYMENT_METHODS = ['Cash', 'GCash', 'Card'];
const SIZES = ['Medium', 'Large'];

// Every place the logo appears goes through here, so the right-click/drag
// deterrents only need to be defined once.
function Logo({ size, alt = SHOP_NAME, className = '' }) {
  return (
    <img
      src="/favicon.svg"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={`protected-image ${className}`}
    />
  );
}

// ============================================================
// Helpers
// ============================================================
function formatPHP(amount) {
  return 'P' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Compact version (no decimals) for tight spaces, e.g. the size-picker buttons.
function formatPHPShort(amount) {
  return 'P' + Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
}
function getStockStatus(item) {
  if (item.stock <= 0) return 'Out of Stock';
  if (item.stock <= item.reorderLevel) return 'Low Stock';
  return 'OK';
}
function statusClass(status) {
  if (status === 'Out of Stock') return 'bg-lychee-light text-lychee';
  if (status === 'Low Stock') return 'bg-brown-sugar-light text-brown-sugar';
  return 'bg-matcha-light text-matcha';
}
// Local (not UTC) date/time strings for the <input type="date"/time"> fields,
// and a safe way to turn a chosen date+time back into a stored timestamp.
function nowDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function nowTimeStr() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function buildTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return new Date().toISOString();
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

// ------------------------------------------------------------
// Shared data — every visitor to the deployed site reads/writes the
// same store via these calls (see /api/data.js and /api/login.js).
// Reads are public; writes require a valid token from /api/login.
// ------------------------------------------------------------
const SESSION_KEY = 'happysips:session';

async function apiGet(key) {
  const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Failed to load ${key}.`);
  return body.value;
}

async function apiPost(key, value, token) {
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key, value }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Save failed.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

async function apiLogin(username, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Invalid username or password.' };
    return { ok: true, user: body.user, token: body.token };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

async function apiRequestAccount(fields) {
  try {
    const res = await fetch('/api/account-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Could not submit request.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

async function apiListAccountRequests(token) {
  try {
    const res = await fetch('/api/account-requests', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Could not load requests.' };
    return { ok: true, requests: body.value };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

async function apiReviewAccountRequest(id, action, token) {
  try {
    const res = await fetch('/api/account-requests-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || 'Could not update request.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

// Session (token + who's logged in) is stored locally per-device — that's
// correct even for shared data, since a login is inherently per-person.
function decodeTokenPayload(token) {
  try {
    const [body] = token.split('.');
    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}
function saveSession(user, token) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token })); } catch {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const payload = decodeTokenPayload(parsed.token || '');
    if (!payload || !payload.exp || payload.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

// ============================================================
// Small shared components
// ============================================================
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const tones = {
    taro: 'bg-taro-light text-taro-deep',
    lychee: 'bg-lychee-light text-lychee',
    brownSugar: 'bg-brown-sugar-light text-brown-sugar',
    matcha: 'bg-matcha-light text-matcha',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone || 'taro']}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="font-display text-lg font-semibold text-pearl truncate">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(42,34,51,0.55)' }}>
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-screen overflow-y-auto font-body`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-display text-lg font-semibold text-pearl">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ReceiptModal({ sale, onClose }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center p-4 z-50 gap-5" style={{ background: 'rgba(42,34,51,0.75)' }}>
      <button onClick={onClose} className="absolute top-5 right-5 text-white opacity-80 hover:opacity-100">
        <X size={22} />
      </button>
      <div className="w-full max-w-xs">
        <div className="bg-white rounded-t-lg px-6 pt-7 pb-5 font-receipt text-pearl">
          <div className="text-center mb-4">
            <p className="font-display text-lg font-semibold">{SHOP_NAME}</p>
            <p className="text-xs text-slate-400 mt-0.5 tracking-widest">SALES RECEIPT</p>
          </div>
          <div className="text-xs text-slate-500 space-y-0.5 mb-3">
            <div className="flex justify-between"><span>Date</span><span>{new Date(sale.timestamp).toLocaleDateString('en-PH')}</span></div>
            <div className="flex justify-between"><span>Time</span><span>{new Date(sale.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="flex justify-between"><span>Cashier</span><span>{sale.cashier}</span></div>
            <div className="flex justify-between"><span>Customer</span><span>{sale.customer}</span></div>
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="space-y-1.5">
            {sale.items.map((it, idx) => (
              <div key={idx} className="flex items-baseline gap-1.5 text-xs">
                <span className="whitespace-nowrap">{it.name} ({it.size}) x{it.qty}</span>
                <span className="flex-1 border-b border-dotted border-slate-300 mb-1" />
                <span className="whitespace-nowrap">{formatPHP(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-slate-300 my-3" />
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatPHP(sale.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>Payment</span><span>{sale.payment}</span>
          </div>
          {sale.payment === 'GCash' && sale.reference && (
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Reference #</span><span>{sale.reference}</span>
            </div>
          )}
          <p className="text-center text-xs text-slate-400 mt-5 tracking-widest">THANK YOU, SIP HAPPY!</p>
        </div>
        <div style={{
          height: '14px',
          backgroundImage: 'linear-gradient(135deg, white 8px, transparent 8px), linear-gradient(-135deg, white 8px, transparent 8px)',
          backgroundSize: '16px 16px',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'top',
        }} />
      </div>
      <button onClick={onClose} className="btn-primary font-semibold py-2.5 px-8 rounded-full text-sm shadow-lg">
        New Sale
      </button>
    </div>
  );
}

// ============================================================
// Login
// ============================================================
const REQUEST_ROLES = ['Staff', 'Admin'];

function RequestAccountForm({ onBack }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState(REQUEST_ROLES[0]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (/\s/.test(username)) {
      setError('Username cannot contain spaces.');
      return;
    }
    setSubmitting(true);
    const result = await apiRequestAccount({ name, username, password, contact, role });
    setSubmitting(false);
    if (result.ok) {
      setSent(true);
    } else {
      setError(result.error);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-matcha-light text-matcha flex items-center justify-center mx-auto mb-3">
          <Check size={22} />
        </div>
        <p className="font-display font-semibold text-pearl mb-1">Request sent</p>
        <p className="text-sm text-slate-500 mb-5">The shop owner has been notified. You'll be able to log in once it's approved.</p>
        <button onClick={onBack} className="text-sm font-semibold text-taro hover:text-taro-deep">
          Back to login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name</label>
        <input value={name} onChange={e => setName(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro" placeholder="Juan Dela Cruz" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Desired Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro" placeholder="juan" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Confirm</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone or Email</label>
        <input value={contact} onChange={e => setContact(e.target.value)} required className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro" placeholder="So the owner can reach you" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Requesting Access As</label>
        <select value={role} onChange={e => setRole(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus-taro">
          {REQUEST_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-lychee font-medium">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full btn-primary font-semibold py-2.5 rounded-xl disabled:opacity-60">
        {submitting ? 'Sending...' : 'Send Request'}
      </button>
      <button type="button" onClick={onBack} className="w-full text-center text-sm font-medium text-slate-400 hover:text-slate-600 pt-1">
        Back to login
      </button>
    </form>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'request'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await apiLogin(username, password);
    setSubmitting(false);
    if (result.ok) {
      onLogin(result.user, result.token);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-body" style={{ background: 'linear-gradient(135deg, #3F2C63, #5B4088 55%, #7A5AAE)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo size={64} className="mb-3" />
          <h1 className="font-display text-xl font-semibold text-pearl">{SHOP_NAME}</h1>
          <p className="text-sm text-slate-400">Shop Management System</p>
        </div>

        {mode === 'request' ? (
          <RequestAccountForm onBack={() => setMode('login')} />
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Username</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-taro">
                  <User size={16} className="text-slate-400 mr-2" />
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="flex-1 outline-none text-sm text-slate-700"
                    placeholder="Enter username"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1 block">Password</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2.5 focus-taro">
                  <Lock size={16} className="text-slate-400 mr-2" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="flex-1 outline-none text-sm text-slate-700"
                    placeholder="Enter password"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-lychee font-medium">{error}</p>}
              <button type="submit" disabled={submitting} className="w-full btn-primary font-semibold py-2.5 rounded-xl disabled:opacity-60">
                {submitting ? 'Logging in...' : 'Log In'}
              </button>
            </form>
            <div className="mt-5 pt-4 border-t border-slate-100 text-center space-y-2">
              <p className="text-xs text-slate-400">The <code>admin</code>/<code>staff</code> demo logins are view-only.</p>
              <button onClick={() => setMode('request')} className="text-sm font-semibold text-taro hover:text-taro-deep block w-full">
                Request a real account →
              </button>
                href={`mailto:lykadinglasan12@gmail.com?subject=${encodeURIComponent('Message from ' + SHOP_NAME + ' website')}`}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Contact us
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sidebar
// ============================================================
function Sidebar({ view, setView, currentUser, onLogout, pendingCount }) {
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'inventory', label: 'Inventory', icon: Package },
    { key: 'sales', label: 'Sales', icon: ShoppingCart },
  ];
  if (currentUser.verified && currentUser.role === 'Admin') {
    items.push({ key: 'accountRequests', label: 'Account Requests', icon: UserPlus, badge: pendingCount });
  }
  return (
    <div className="w-16 sm:w-56 flex flex-col shrink-0 min-h-screen bg-taro-deep">
      <div className="flex items-center gap-2 px-4 sm:px-5 py-6 justify-center sm:justify-start">
        <Logo size={36} className="shrink-0" />
        <div className="hidden sm:block">
          <p className="font-display font-semibold text-sm leading-tight text-white">{SHOP_NAME}</p>
          <p className="text-xs text-taro-pale">Shop Manager</p>
        </div>
      </div>
      <nav className="flex-1 px-2 sm:px-3 space-y-1">
        {items.map(it => (
          <button
            key={it.key}
            title={it.label}
            onClick={() => setView(it.key)}
            className={`w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium relative ${
              view === it.key ? 'nav-item-active' : 'nav-item'
            }`}
          >
            <span className="relative">
              <it.icon size={17} />
              {!!it.badge && (
                <span className="sm:hidden absolute -top-1.5 -right-1.5 bg-lychee text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none" style={{ fontSize: '9px' }}>
                  {it.badge}
                </span>
              )}
            </span>
            <span className="hidden sm:inline flex-1 text-left">{it.label}</span>
            {!!it.badge && (
              <span className="hidden sm:flex bg-lychee text-white text-xs font-semibold rounded-full min-w-5 h-5 px-1.5 items-center justify-center">
                {it.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-2 sm:px-3 pb-5 space-y-1">
        <div className="hidden sm:block px-3 py-3 mb-1 rounded-xl bg-taro">
          <p className="text-xs font-semibold text-white">{currentUser.name}</p>
          <p className="text-xs text-taro-pale">{currentUser.role}{!currentUser.verified && ' (view only)'}</p>
        </div>
        <button title="Log Out" onClick={onLogout} className="nav-item w-full flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium">
          <LogOut size={16} />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================
function DashboardView({ sales, inventory, menu }) {
  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalOrders = sales.length;
  const lowStock = inventory.filter(i => getStockStatus(i) !== 'OK');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Total Sales" value={formatPHP(totalSales)} tone="taro" />
        <KpiCard icon={Receipt} label="Total Orders" value={totalOrders} tone="matcha" />
        <KpiCard icon={AlertTriangle} label="Low Stock Items" value={lowStock.length} tone="lychee" />
        <KpiCard icon={Package} label="Menu Items" value={menu.length} tone="brownSugar" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-brown-sugar" />
          <h3 className="font-display font-semibold text-slate-700">Low Stock Alerts</h3>
        </div>
        {lowStock.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">All inventory items are sufficiently stocked.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{item.stock} {item.unit} left</span>
                  <StatusBadge status={getStockStatus(item)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Inventory
// ============================================================
function ItemFormModal({ initial, error, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: '', category: INVENTORY_CATEGORIES[0], unit: UNITS[0], stock: 0, reorderLevel: 0 });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, stock: Number(form.stock), reorderLevel: Number(form.reorderLevel) });
  }

  return (
    <Modal title={initial ? 'Edit Item' : 'Add Inventory Item'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Item Name</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-taro" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
            <select value={form.category} onChange={e => update('category', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-taro">
              {INVENTORY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Unit</label>
            <select value={form.unit} onChange={e => update('unit', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-taro">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Current Stock</label>
            <input type="number" min="0" value={form.stock} onChange={e => update('stock', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-taro" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Reorder Level</label>
            <input type="number" min="0" value={form.reorderLevel} onChange={e => update('reorderLevel', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus-taro" />
          </div>
        </div>
        {error && <p className="text-xs text-lychee font-medium">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200">Cancel</button>
          <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-primary">Save Item</button>
        </div>
      </form>
    </Modal>
  );
}

function InventoryView({ inventory, setInventory, currentUser, canEdit }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formError, setFormError] = useState('');

  const filtered = inventory.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  async function handleSave(item) {
    let updated;
    if (item.id) {
      updated = inventory.map(i => i.id === item.id ? item : i);
    } else {
      updated = [...inventory, { ...item, id: 'i_' + Date.now() }];
    }
    const previous = inventory;
    setInventory(updated);
    const result = await apiPost('inventory:items', updated, currentUser.token);
    if (!result.ok) {
      setInventory(previous);
      setFormError(result.error);
      return;
    }
    setFormError('');
    setEditing(null);
  }

  async function handleDelete(id) {
    const updated = inventory.filter(i => i.id !== id);
    const previous = inventory;
    setInventory(updated);
    const result = await apiPost('inventory:items', updated, currentUser.token);
    if (!result.ok) {
      setInventory(previous);
      setFormError(result.error);
    }
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus-taro"
          />
        </div>
        {canEdit && (
          <button onClick={() => { setFormError(''); setEditing('new'); }} className="flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl">
            <Plus size={16} /> Add Item
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Item Name</th>
                <th className="text-left px-5 py-3 font-semibold">Category</th>
                <th className="text-left px-5 py-3 font-semibold">Stock</th>
                <th className="text-left px-5 py-3 font-semibold">Reorder Level</th>
                <th className="text-left px-5 py-3 font-semibold">Status</th>
                {canEdit && <th className="text-right px-5 py-3 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-700">{item.name}</td>
                  <td className="px-5 py-3 text-slate-500">{item.category}</td>
                  <td className="px-5 py-3 text-slate-600">{item.stock} {item.unit}</td>
                  <td className="px-5 py-3 text-slate-500">{item.reorderLevel} {item.unit}</td>
                  <td className="px-5 py-3"><StatusBadge status={getStockStatus(item)} /></td>
                  {canEdit && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setFormError(''); setEditing(item); }} className="p-1.5 text-slate-400 hover:text-taro hover:bg-taro-light rounded-lg">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setConfirmDelete(item)} className="p-1.5 text-slate-400 hover:text-lychee hover:bg-lychee-light rounded-lg">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={canEdit ? 6 : 5} className="px-5 py-10 text-center text-slate-400 text-sm">No items match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formError && !editing && (
        <p className="text-xs text-lychee font-medium bg-lychee-light rounded-xl px-4 py-2.5">{formError}</p>
      )}

      {editing && (
        <ItemFormModal
          initial={editing === 'new' ? null : editing}
          error={formError}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete Item?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-slate-500 mb-5">
            Delete <span className="font-semibold text-slate-700">{confirmDelete.name}</span>? This can't be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-lychee hover:opacity-90">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// Sales / POS
// ============================================================
function SalesView({ menu, sales, setSales, currentUser }) {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('');
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [gcashRef, setGcashRef] = useState('');
  const [saleDate, setSaleDate] = useState(nowDateStr());
  const [saleTime, setSaleTime] = useState(nowTimeStr());
  const [receipt, setReceipt] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [confirmDeleteSale, setConfirmDeleteSale] = useState(null);
  const [saleError, setSaleError] = useState('');

  function addToCart(item, size) {
    const price = item.sizes[size];
    setCart(prev => {
      const found = prev.find(c => c.menuId === item.id && c.size === size);
      if (found) return prev.map(c => (c.menuId === item.id && c.size === size) ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { menuId: item.id, name: item.name, category: item.category, size, price, qty: 1 }];
    });
  }
  function changeQty(menuId, size, delta) {
    setCart(prev => prev.map(c => (c.menuId === menuId && c.size === size) ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  }
  function removeItem(menuId, size) {
    setCart(prev => prev.filter(c => !(c.menuId === menuId && c.size === size)));
  }

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const categories = ['All', ...MENU_CATEGORIES];
  const visibleMenu = activeCategory === 'All' ? menu : menu.filter(m => m.category === activeCategory);

  async function completeSale() {
    if (cart.length === 0) return;
    const sale = {
      id: 'sale_' + Date.now(),
      timestamp: buildTimestamp(saleDate, saleTime),
      items: cart,
      total,
      customer: customer.trim() || 'Walk-in Customer',
      payment,
      reference: payment === 'GCash' ? gcashRef.trim() : '',
      cashier: currentUser.username,
    };
    const updated = [sale, ...sales];
    const previous = sales;
    setSales(updated);
    const result = await apiPost('sales:records', updated, currentUser.token);
    if (!result.ok) {
      setSales(previous);
      setSaleError(result.error);
      return;
    }
    setSaleError('');
    setCart([]);
    setCustomer('');
    setGcashRef('');
    setReceipt(sale);
  }

  async function handleDeleteSale(id) {
    const updated = sales.filter(s => s.id !== id);
    const previous = sales;
    setSales(updated);
    const result = await apiPost('sales:records', updated, currentUser.token);
    if (!result.ok) {
      setSales(previous);
      setSaleError(result.error);
    }
    setConfirmDeleteSale(null);
  }

  const sortedSales = [...sales].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const filteredSales = sortedSales.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const dateStr = new Date(s.timestamp).toLocaleDateString('en-PH').toLowerCase();
    return (
      s.customer.toLowerCase().includes(q) ||
      dateStr.includes(q) ||
      (s.reference && s.reference.toLowerCase().includes(q)) ||
      s.items.some(it => it.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
                  activeCategory === c ? 'btn-primary border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-taro'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleMenu.map(item => (
              <div
                key={item.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-semibold text-slate-700 leading-snug">{item.name}</p>
                <p className="text-xs text-slate-400 mt-1 mb-3">{item.category}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {SIZES.map(size => (
                    <button
                      key={size}
                      title={`Add ${size}`}
                      onClick={() => addToCart(item, size)}
                      className="flex flex-col items-center justify-center rounded-lg py-1.5 bg-taro-light text-taro-deep hover:bg-taro hover:text-white transition-colors"
                    >
                      <span className="text-xs font-semibold leading-tight">{size}</span>
                      <span className="text-xs leading-tight">{formatPHPShort(item.sizes[size])}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit lg:sticky lg:top-4">
          <h3 className="font-display font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-taro" /> Current Order
          </h3>
          {cart.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Tap a menu item to add it to the order.</p>
          ) : (
            <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
              {cart.map(c => (
                <div key={`${c.menuId}-${c.size}`} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{c.name} <span className="font-normal text-slate-400">({c.size})</span></p>
                    <p className="text-xs text-slate-400">{formatPHP(c.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => changeQty(c.menuId, c.size, -1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-semibold w-4 text-center">{c.qty}</span>
                    <button onClick={() => changeQty(c.menuId, c.size, 1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeItem(c.menuId, c.size)} className="w-6 h-6 rounded-lg hover:bg-lychee-light flex items-center justify-center text-slate-300 hover:text-lychee">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus-taro"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Time</label>
                <input
                  type="time"
                  value={saleTime}
                  onChange={e => setSaleTime(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus-taro"
                />
              </div>
            </div>
            <input
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus-taro"
            />
            <select value={payment} onChange={e => setPayment(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus-taro">
              {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {payment === 'GCash' && (
              <input
                value={gcashRef}
                onChange={e => setGcashRef(e.target.value)}
                placeholder="GCash reference number"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-receipt focus-taro"
              />
            )}
            <div className="flex justify-between text-sm font-bold text-slate-700 pt-1">
              <span>Total</span>
              <span>{formatPHP(total)}</span>
            </div>
            {!currentUser.verified && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
                This is a view-only demo account. Log out and use "Request a real account" to record real sales.
              </p>
            )}
            {saleError && <p className="text-xs text-lychee font-medium">{saleError}</p>}
            <button
              onClick={completeSale}
              disabled={cart.length === 0 || !currentUser.verified}
              className="w-full btn-primary font-semibold py-2.5 rounded-xl text-sm"
            >
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {saleError && (
        <p className="text-xs text-lychee font-medium bg-lychee-light rounded-xl px-4 py-2.5">{saleError}</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-slate-700">Sales History</h3>
            <span className="text-xs text-slate-400">{sales.length} total</span>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer, item, or date..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus-taro"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Date</th>
                <th className="text-left px-5 py-3 font-semibold">Time</th>
                <th className="text-left px-5 py-3 font-semibold">Customer</th>
                <th className="text-left px-5 py-3 font-semibold">Items</th>
                <th className="text-left px-5 py-3 font-semibold">Payment</th>
                <th className="text-right px-5 py-3 font-semibold">Amount</th>
                <th className="text-right px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(s => (
                <tr key={s.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 text-slate-500 font-receipt">{new Date(s.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-5 py-3 text-slate-500 font-receipt">{new Date(s.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-5 py-3 text-slate-600">{s.customer}</td>
                  <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{s.items.map(i => `${i.name} (${i.size}) x${i.qty}`).join(', ')}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {s.payment}
                    {s.payment === 'GCash' && s.reference && (
                      <div className="text-xs text-slate-400 font-receipt">{s.reference}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-700">{formatPHP(s.total)}</td>
                  <td className="px-5 py-3 text-right">
                    {currentUser.verified && (
                      <button onClick={() => setConfirmDeleteSale(s)} className="p-1.5 text-slate-400 hover:text-lychee hover:bg-lychee-light rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                  {sales.length === 0 ? 'No sales recorded yet.' : 'No sales match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}

      {confirmDeleteSale && (
        <Modal title="Delete Sale?" onClose={() => setConfirmDeleteSale(null)}>
          <p className="text-sm text-slate-500 mb-5">
            Delete this {formatPHP(confirmDeleteSale.total)} sale from{' '}
            <span className="font-semibold text-slate-700">
              {new Date(confirmDeleteSale.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>? This can't be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeleteSale(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200">Cancel</button>
            <button onClick={() => handleDeleteSale(confirmDeleteSale.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-lychee hover:opacity-90">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// Account Requests — verified Admin only. This is the actual
// gatekeeping mechanism: approving here is what turns a request
// into a real, working login.
// ============================================================
function AccountRequestsView({ currentUser, onRequestsChanged }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState(null);

  async function load() {
    setLoading(true);
    const result = await apiListAccountRequests(currentUser.token);
    if (result.ok) {
      setRequests(result.requests);
      setError('');
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleReview(id, action) {
    setActingOn(id);
    const result = await apiReviewAccountRequest(id, action, currentUser.token);
    setActingOn(null);
    if (result.ok) {
      setRequests(prev => prev.filter(r => r.id !== id));
      onRequestsChanged?.();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="font-display font-semibold text-slate-700">Pending Account Requests</h3>
        <p className="text-xs text-slate-400 mt-0.5">Approving grants real access to add and edit sales/inventory.</p>
      </div>
      {error && <p className="text-xs text-lychee font-medium px-5 py-2.5 bg-lychee-light">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No pending requests.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {requests.map(r => (
            <div key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  {r.name} <span className="font-normal text-slate-400">wants {r.role} access</span>
                </p>
                <p className="text-xs text-slate-400 font-receipt truncate">@{r.username} &middot; {r.contact}</p>
                <p className="text-xs text-slate-400">
                  {new Date(r.requestedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={actingOn === r.id}
                  onClick={() => handleReview(r.id, 'deny')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  disabled={actingOn === r.id}
                  onClick={() => handleReview(r.id, 'approve')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold btn-primary disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// App root
// ============================================================
export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [inventory, setInventory] = useState([]);
  const [menu, setMenu] = useState([]);
  const [sales, setSales] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [now, setNow] = useState(new Date());
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshPendingCount(user) {
    const u = user || currentUser;
    if (!u?.verified || u.role !== 'Admin') { setPendingCount(0); return; }
    const result = await apiListAccountRequests(u.token);
    if (result.ok) setPendingCount(result.requests.length);
  }

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setCurrentUser({ ...session.user, token: session.token });
      refreshPendingCount({ ...session.user, token: session.token });
    }

    async function init() {
      try {
        const [inv, mn, sl] = await Promise.all([
          apiGet('inventory:items'),
          apiGet('menu:items'),
          apiGet('sales:records'),
        ]);
        setInventory(inv);
        setMenu(mn);
        setSales(sl);
      } catch (e) {
        setLoadError(e.message || 'Could not connect to the shared database.');
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  function handleLoginSuccess(user, token) {
    setCurrentUser({ ...user, token });
    saveSession(user, token);
    refreshPendingCount({ ...user, token });
  }

  function handleLogout() {
    setCurrentUser(null);
    setPendingCount(0);
    clearSession();
  }

  const dateStr = now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="min-h-screen bg-milk flex items-center justify-center font-body">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-taro-light rounded-full animate-spin" style={{ borderTopColor: 'var(--taro)' }} />
          <p className="text-sm text-slate-400">Loading {SHOP_NAME}...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-milk flex items-center justify-center font-body p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-sm p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-lychee-light text-lychee flex items-center justify-center mx-auto mb-3">
            <AlertTriangle size={22} />
          </div>
          <h2 className="font-display font-semibold text-pearl mb-2">Can't reach the shared database</h2>
          <p className="text-sm text-slate-500 mb-1">{loadError}</p>
          <p className="text-xs text-slate-400 mt-3">
            If you just deployed this, make sure Upstash is linked in your Vercel project's Storage tab and that AUTH_SECRET is set as an environment variable, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-body">
      <Sidebar view={view} setView={setView} currentUser={currentUser} onLogout={handleLogout} pendingCount={pendingCount} />
      <div className="flex-1 min-w-0">
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-pearl">
              {view === 'dashboard' && 'Welcome back!'}
              {view === 'inventory' && 'Inventory Management'}
              {view === 'sales' && 'Point of Sale'}
              {view === 'accountRequests' && 'Account Requests'}
            </h2>
            <p className="text-xs text-slate-400">{dateStr} &middot; {timeStr}</p>
          </div>
        </div>
        <div className="p-6">
          {view === 'dashboard' && <DashboardView sales={sales} inventory={inventory} menu={menu} />}
          {view === 'inventory' && <InventoryView inventory={inventory} setInventory={setInventory} currentUser={currentUser} canEdit={currentUser.role === 'Admin' && currentUser.verified} />}
          {view === 'sales' && <SalesView menu={menu} sales={sales} setSales={setSales} currentUser={currentUser} />}
          {view === 'accountRequests' && currentUser.verified && currentUser.role === 'Admin' && (
            <AccountRequestsView currentUser={currentUser} onRequestsChanged={() => refreshPendingCount()} />
          )}
        </div>
      </div>
    </div>
  );
}
