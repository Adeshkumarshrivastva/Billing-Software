'use client';
import { Mail, Pencil, Plus, Search, UserRound, UserX, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { formatDate, initialsFor, todayISO } from '@/lib/format';
import type { Gender } from '@/lib/types';
import { useBilling, type PatientWithStats } from '@/lib/store';
import { useToast } from '@/lib/toast';

const tones = ['tone-0', 'tone-1', 'tone-2'];
const genders: Gender[] = ['Male', 'Female', 'Other'];

export default function PatientsPage() {
  const { patients, addPatient, updatePatient, loading } = useBilling();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<PatientWithStats | null>(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deactivating, setDeactivating] = useState<PatientWithStats | null>(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivateSaving, setDeactivateSaving] = useState(false);

  const filtered = patients.filter((patient) => `${patient.name} ${patient.phone} ${patient.email ?? ''}`.toLowerCase().includes(query.toLowerCase()));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const age = Number(form.get('age'));
    if (!name || !phone || !age) { setError('Name, age and phone are required.'); return; }
    setSaving(true);
    try {
      await addPatient({
        name,
        age,
        gender: form.get('gender') as Gender,
        phone,
        email: String(form.get('email') || '').trim() || undefined,
        address: String(form.get('address') || '').trim() || undefined,
        guardianName: String(form.get('guardianName') || '').trim() || undefined,
        date: String(form.get('date') || '').trim() || undefined,
      });
      setOpen(false);
      setError('');
      showToast('Patient registered successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this patient.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const age = Number(form.get('age'));
    if (!name || !phone || !age) { setEditError('Name, age and phone are required.'); return; }
    setEditSaving(true);
    try {
      await updatePatient(editing.id, {
        name,
        age,
        gender: form.get('gender') as Gender,
        phone,
        email: String(form.get('email') || '').trim() || undefined,
        address: String(form.get('address') || '').trim() || undefined,
        guardianName: String(form.get('guardianName') || '').trim() || undefined,
        date: String(form.get('date') || '').trim() || undefined,
      });
      setEditing(null);
      setEditError('');
      showToast('Patient details updated successfully.');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivating) return;
    setDeactivateSaving(true);
    try {
      await updatePatient(deactivating.id, { status: 'Inactive' });
      setDeactivating(null);
      setDeactivateError('');
      showToast('Patient marked inactive.');
    } catch (err) {
      setDeactivateError(err instanceof Error ? err.message : 'Could not deactivate this patient.');
    } finally {
      setDeactivateSaving(false);
    }
  };

  const mailAll = () => {
    const addresses = filtered.map((p) => p.email).filter(Boolean).join(',');
    window.location.href = `mailto:?bcc=${encodeURIComponent(addresses)}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
        <h1>Patients Details</h1></div>
        <button className="button primary" onClick={() => setOpen(true)}><Plus size={16} /> Register patient</button>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients by name or phone" /></div>
        {/* <button className="button secondary" onClick={mailAll} disabled={filtered.length === 0}><Mail size={15} /> Email list</button> */}
      </div>
      <section className="card section-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Patient</th><th>Contact</th><th>Age</th><th>Gender</th><th>Guardian</th><th>Address</th><th>Registered</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((patient, index) => (
                <tr key={patient.id}>
                  <td>
                    <div className="customer-cell">
                      <span className={`avatar-chip ${tones[index % tones.length]}`}>{initialsFor(patient.name)}</span>
                      <div><div className="customer-name"><UserRound size={13} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--primary)' }} />{patient.name}</div><div className="customer-email">{patient.id}</div></div>
                    </div>
                  </td>
                  <td>
                    <div className="customer-name">{patient.phone || <span className="subtitle">—</span>}</div>
                    {patient.email && <div className="customer-email">{patient.email}</div>}
                  </td>
                  <td>{patient.age ?? <span className="subtitle">—</span>}</td>
                  <td>{patient.gender ?? <span className="subtitle">—</span>}</td>
                  <td>{patient.guardianName ?? <span className="subtitle">—</span>}</td>
                  <td>{patient.address ?? <span className="subtitle">—</span>}</td>
                  <td>{(patient.date || patient.createdAt) ? formatDate(patient.date || patient.createdAt) : <span className="subtitle">—</span>}</td>
                  <td><span className={`badge ${patient.status.toLowerCase()}`}>{patient.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-button" aria-label="Edit patient" onClick={() => { setEditing(patient); setEditError(''); }}><Pencil size={14} /></button>
                      {patient.status === 'Active' && (
                        <button className="icon-button" aria-label="Deactivate patient" onClick={() => { setDeactivating(patient); setDeactivateError(''); }}><UserX size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="empty-state">No patients found.</div>}
        </div>
      </section>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <form className="card modal-card" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
            <div className="modal-head"><h2>Register patient</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button></div>
            {error && <div className="modal-error">{error}</div>}
            <div className="form-grid">
              <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" required placeholder="Priya Sharma" /></div>
              <div className="field"><label htmlFor="age">Age</label><input id="age" name="age" type="number" min="0" required placeholder="34" /></div>
              <div className="field"><label htmlFor="gender">Gender</label><select id="gender" name="gender" defaultValue="Female">{genders.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
              <div className="field"><label htmlFor="date">Registration date</label><input id="date" name="date" type="date" defaultValue={todayISO()} /></div>
              <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" required placeholder="+91 90000 00000" /></div>
              <div className="field"><label htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" placeholder="priya@example.com" /></div>
              <div className="field"><label htmlFor="guardianName">Guardian (if minor)</label><input id="guardianName" name="guardianName" placeholder="Parent / guardian name" /></div>
              <div className="field full"><label htmlFor="address">Address</label><input id="address" name="address" placeholder="Kothrud, Pune" /></div>
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save patient'}</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="card modal-card" onClick={(event) => event.stopPropagation()} onSubmit={handleEditSubmit}>
            <div className="modal-head"><h2>Edit patient</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><X size={16} /></button></div>
            {editError && <div className="modal-error">{editError}</div>}
            <div className="form-grid">
              <div className="field"><label htmlFor="edit-name">Full name</label><input id="edit-name" name="name" required defaultValue={editing.name} /></div>
              <div className="field"><label htmlFor="edit-age">Age</label><input id="edit-age" name="age" type="number" min="0" required defaultValue={editing.age ?? ''} /></div>
              <div className="field"><label htmlFor="edit-gender">Gender</label><select id="edit-gender" name="gender" defaultValue={editing.gender ?? 'Female'}>{genders.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
              <div className="field"><label htmlFor="edit-date">Registration date</label><input id="edit-date" name="date" type="date" defaultValue={(editing.date || editing.createdAt || '').slice(0, 10)} /></div>
              <div className="field"><label htmlFor="edit-phone">Phone</label><input id="edit-phone" name="phone" required defaultValue={editing.phone ?? ''} /></div>
              <div className="field"><label htmlFor="edit-email">Email (optional)</label><input id="edit-email" name="email" type="email" defaultValue={editing.email ?? ''} /></div>
              <div className="field"><label htmlFor="edit-guardianName">Guardian (if minor)</label><input id="edit-guardianName" name="guardianName" defaultValue={editing.guardianName ?? ''} /></div>
              <div className="field full"><label htmlFor="edit-address">Address</label><input id="edit-address" name="address" defaultValue={editing.address ?? ''} /></div>
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="button primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {deactivating && (
        <div className="modal-overlay" onClick={() => setDeactivating(null)}>
          <div className="card modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><h2>Deactivate patient?</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setDeactivating(null)}><X size={16} /></button></div>
            {deactivateError && <div className="modal-error">{deactivateError}</div>}
            <p className="subtitle">
              <strong style={{ color: 'var(--ink)' }}>{deactivating.name}</strong> will be marked Inactive. This can&apos;t be undone — once a patient is deactivated, they can&apos;t be made active again.
            </p>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setDeactivating(null)}>Cancel</button>
              <button type="button" className="button danger" onClick={confirmDeactivate} disabled={deactivateSaving}><UserX size={14} /> {deactivateSaving ? 'Deactivating…' : 'Deactivate'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
