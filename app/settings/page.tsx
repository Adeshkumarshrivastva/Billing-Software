'use client';
import { Check, Globe2, Palette, Save, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useBilling } from '@/lib/store';
import { useToast } from '@/lib/toast';

export default function SettingsPage() {
  const { profile, updateProfile, loading } = useBilling();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await updateProfile({
        name: String(form.get('name') || profile.name),
        email: String(form.get('email') || profile.email),
        phone: String(form.get('phone') || profile.phone),
        registrationNo: String(form.get('registrationNo') || '').trim(),
        address: String(form.get('address') || profile.address),
        currency: (String(form.get('currency') || profile.currency) as typeof profile.currency),
        billPrefix: String(form.get('billPrefix') || profile.billPrefix).trim() || 'BILL-',
        upiVpa: String(form.get('upiVpa') || '').trim(),
        upiName: String(form.get('upiName') || '').trim(),
      });
      setError('');
      setSaved(true);
      showToast('Clinic profile updated successfully.');
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <form onSubmit={handleSubmit}>
        <div className="page-header">
          <div><p className="eyebrow">Workspace controls</p><h1>Settings</h1><p className="subtitle">Make PMC feel like your clinic.</p></div>
          <button className="button primary" type="submit" disabled={saving}>{saved ? <><Check size={15} /> Changes saved</> : <><Save size={15} /> {saving ? 'Saving…' : 'Save changes'}</>}</button>
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="settings-layout">
          <aside className="settings-nav">
            <button type="button" className="selected"><Globe2 size={15} /> Clinic profile</button>
            <button type="button"><Palette size={15} /> Bill appearance</button>
            <button type="button"><ShieldCheck size={15} /> Security &amp; access</button>
          </aside>
          <section className="card section-card">
            <h2>Clinic profile</h2>
            <p className="subtitle" style={{ marginTop: 6, marginBottom: 16 }}>This information appears on patient bills.</p>
            {loading ? (
              <div className="empty-state">Loading clinic profile…</div>
            ) : (
              // Keyed on the loaded profile so these uncontrolled inputs always mount
              // with real values — defaultValue only applies on an input's first render.
              <div className="form-grid" key={profile.name}>
                <div className="field"><label htmlFor="clinic-name">Clinic name</label><input id="clinic-name" name="name" defaultValue={profile.name} /></div>
                <div className="field"><label htmlFor="clinic-email">Clinic email</label><input id="clinic-email" name="email" defaultValue={profile.email} type="email" /></div>
                <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" defaultValue={profile.phone} /></div>
                {/* <div className="field"><label htmlFor="registrationNo">Registration / license no.</label><input id="registrationNo" name="registrationNo" defaultValue={profile.registrationNo} placeholder="MH/CLINIC/2019/04471" /></div> */}
                <div className="field"><label htmlFor="currency">Default currency</label><select id="currency" name="currency" defaultValue={profile.currency}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option></select></div>
                <div className="field"><label htmlFor="billPrefix">Bill number prefix</label><input id="billPrefix" name="billPrefix" defaultValue={profile.billPrefix} /></div>
                <div className="field"><label htmlFor="upiVpa">Clinic UPI ID</label><input id="upiVpa" name="upiVpa" defaultValue={profile.upiVpa} placeholder="pmccare@hdfcbank" /></div>
                <div className="field"><label htmlFor="upiName">UPI payee name</label><input id="upiName" name="upiName" defaultValue={profile.upiName} placeholder="PMC Care Clinic" /></div>
                <div className="field full"><label htmlFor="address">Clinic address</label><textarea id="address" name="address" defaultValue={profile.address} /></div>
              </div>
            )}
          </section>
        </div>
      </form>
      {/* Scoped to this page only (styled-jsx) — tighter vertical rhythm so the whole
          form fits one screen without scrolling; other pages' .page/.section-card/etc
          spacing is untouched since this class hash never reaches them. */}
      <style jsx>{`.page{padding-top:26px;padding-bottom:28px}.page-header{margin-bottom:20px}.section-card{padding:20px 24px}.form-grid{gap:14px}.field textarea{min-height:60px}.settings-layout{display:grid;grid-template-columns:210px minmax(0,680px);gap:22px;align-items:start}.settings-nav{display:flex;flex-direction:column;gap:3px}.settings-nav button{display:flex;gap:10px;align-items:center;border:0;background:transparent;color:var(--muted);padding:11px 12px;border-radius:9px;text-align:left;font-size:12px;font-weight:600}.settings-nav button.selected{background:var(--primary-soft);color:var(--primary)}@media(max-width:700px){.settings-layout{grid-template-columns:1fr}.settings-nav{display:grid;grid-template-columns:1fr 1fr 1fr}.settings-nav button{font-size:11px;padding:9px 7px}}`}</style>
    </div>
  );
}
