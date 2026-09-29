'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { flashToast } from '@/lib/toast';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sendOtp = async () => {
    const trimmed = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (!/^\d{10}$/.test(trimmed)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not send OTP.');
      setStep('otp');
      flashToast('OTP sent to your mobile number.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setSaving(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const trimmedPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
      if (!/^\d{10}$/.test(trimmedPhone)) {
        setError('Enter a valid 10-digit mobile number.');
        return;
      }
      if (!/^\d{6}$/.test(otp)) {
        setError('Enter a valid 6-digit OTP.');
        return;
      }
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmedPhone, otp }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not verify OTP.');
      flashToast('Signed in successfully.');
      // Everyone lands on the Overview dashboard with the full sidebar — admin
      // then has every page (Payment history, Bills, …), a regular user has all
      // but the Bills record.
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
      setSaving(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="auth-brand"><img src="/pmc-logo.png" alt="Positive Mind Care" /></div>
        <p className="eyebrow" style={{ textAlign: 'center' }}>PMC · Tech Billing Software</p>
        <h1 className="auth-title">Welcome back</h1>
        <p className="subtitle auth-subtitle">Sign in with your phone number and OTP.</p>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={submit} className="auth-form" autoComplete="off">
          {step === 'phone' ? (
            <div className="field">
              <label htmlFor="phone">Mobile number</label>
              <input id="phone" type="tel" required autoFocus autoComplete="off" data-1p-ignore data-lpignore="true" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" maxLength={10} inputMode="numeric" />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="otp">OTP</label>
                <input id="otp" type="text" required autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter 6-digit OTP" maxLength={6} inputMode="numeric" />
              </div>

            </>
          )}

          {step === 'phone' ? (
            <button type="button" className="button primary auth-submit" disabled={saving} onClick={sendOtp}>
              {saving ? 'Sending OTP…' : 'Send OTP'}
            </button>
          ) : (
            <button type="submit" className="button primary auth-submit" disabled={saving}>
              <LogIn size={15} /> {saving ? 'Verifying…' : 'Verify OTP & continue'}
            </button>
          )}
        </form>

        <p className="auth-switch">New to PMC billing? <Link href="/register">Create an account</Link></p>
      </div>
    </div>
  );
}
