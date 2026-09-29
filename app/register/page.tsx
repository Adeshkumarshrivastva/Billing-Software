'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { PasswordField } from '@/components/password-field';
import { flashToast } from '@/lib/toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!/^\d{10}$/.test(normalizedPhone)) { setError('Enter a valid 10-digit phone number.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: normalizedPhone, email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not create your account.');
      flashToast('Account created successfully. Please sign in.');
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
      setSaving(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand"><img src="/pmc-logo.png" alt="Positive Mind Care" /></div>
        <p className="eyebrow" style={{ textAlign: 'center' }}>PMC · Tech Billing Software</p>
        <h1 className="auth-title">Create your account</h1>
        <p className="subtitle auth-subtitle">Set up staff access to the PMC billing workspace with your mobile number.</p>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={submit} className="auth-form" autoComplete="off">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" required autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" value={name} onChange={(event) => setName(event.target.value)} placeholder="Dr. Ananya Rao" />
          </div>
          <div className="field">
            <label htmlFor="phone">Mobile number</label>
            <input id="phone" type="tel" required autoComplete="off" data-1p-ignore data-lpignore="true" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" maxLength={10} inputMode="numeric" />
          </div>
          <div className="field">
            <label htmlFor="email">Email (optional)</label>
            <input id="email" type="email" autoComplete="off" data-1p-ignore data-lpignore="true" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@positivemindcare.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordField id="password" required minLength={6} value={password} onChange={setPassword} placeholder="At least 6 characters" />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <PasswordField id="confirm" required value={confirm} onChange={setConfirm} placeholder="••••••••" />
          </div>
          <button type="submit" className="button primary auth-submit" disabled={saving}><UserPlus size={15} /> {saving ? 'Creating account…' : 'Create account'}</button>
        </form>

        <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
