'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, FileText, ImagePlus, Images, Plus, Printer, Trash2, X } from 'lucide-react';
import { formatDate, todayISO } from '@/lib/format';
import { type Gender, type Prescription } from '@/lib/types';
import { useBilling } from '@/lib/store';
import { useToast } from '@/lib/toast';

// One photo in the gallery / viewer: the image plus who it belongs to.
type Shot = { src: string; caption: string; rx: Prescription | null };

// Photos are stored inline on the prescription document, so each one is
// downscaled to a sane size (long edge ≤ 1400 px, JPEG) before it is kept.
const MAX_PHOTOS = 6;
const downscaleImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Could not decode the image.'));
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export default function PrescriptionsPage() {
  const { patients, prescriptions, user, addPrescription, deletePrescription } = useBilling();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'create' | 'preview' | 'records' | 'photos'>('create');

  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'' | Gender>('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(todayISO());
  const [complaint, setComplaint] = useState('');
  const [investigation, setInvestigation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Full-screen viewer: the flat list of photos it can page through plus the one
  // currently on screen, so ← / → step through whichever gallery was clicked.
  const [viewer, setViewer] = useState<{ list: Shot[]; index: number } | null>(null);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // A saved prescription pinned to the Preview tab (from Save, or "Open" in the
  // records list). When null, Preview falls back to the live form draft.
  const [previewRx, setPreviewRx] = useState<Prescription | null>(null);
  const [deleting, setDeleting] = useState<Prescription | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Match the typed name against the register and pull in age / sex once.
  const matchedPatient = useMemo(
    () => patients.find((p) => p.name.trim().toLowerCase() === patientName.trim().toLowerCase()),
    [patients, patientName],
  );
  const syncedId = useRef<string | null>(null);
  useEffect(() => {
    if (matchedPatient && matchedPatient.id !== syncedId.current) {
      syncedId.current = matchedPatient.id;
      setAge(matchedPatient.age != null ? String(matchedPatient.age) : '');
      setGender(matchedPatient.gender ?? '');
      setPhone(matchedPatient.phone ?? '');
      setAddress(matchedPatient.address ?? '');
    }
    if (!matchedPatient) syncedId.current = null;
  }, [matchedPatient]);

  const pickPhotos = async (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { showToast(`Up to ${MAX_PHOTOS} photos per prescription.`, 'error'); return; }
    setPhotoBusy(true);
    try {
      const added = await Promise.all(images.slice(0, room).map(downscaleImage));
      setPhotos((prev) => [...prev, ...added]);
      showToast(`${added.length} photo${added.length > 1 ? 's' : ''} added.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add that image.', 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (i: number) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  // Photos still on the unsaved form, then every photo already saved with a
  // prescription — newest record first. This is what the "All photos" tab lists.
  const draftShots: Shot[] = photos.map((src, i) => ({ src, caption: `Draft photo ${i + 1}`, rx: null }));
  const savedGroups = useMemo(
    () =>
      prescriptions
        .filter((rx) => (rx.photos?.length ?? 0) > 0)
        .map((rx) => ({
          rx,
          shots: (rx.photos ?? []).map((src, i) => ({ src, caption: `${rx.id} · ${rx.patientName} · photo ${i + 1}`, rx })),
        })),
    [prescriptions],
  );
  const savedShots = savedGroups.flatMap((g) => g.shots);
  const photoCount = draftShots.length + savedShots.length;

  const openViewer = (list: Shot[], index: number) => setViewer({ list, index });
  const stepViewer = (delta: number) =>
    setViewer((v) => (v ? { ...v, index: (v.index + delta + v.list.length) % v.list.length } : v));

  // Arrow keys / Esc drive the viewer while it is open.
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      else if (e.key === 'ArrowRight') stepViewer(1);
      else if (e.key === 'ArrowLeft') stepViewer(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  const resetForm = () => {
    setPatientName(''); setAge(''); setGender(''); setPhone(''); setAddress(''); setDate(todayISO());
    setComplaint(''); setInvestigation(''); setDiagnosis(''); setPhotos([]); setError('');
    syncedId.current = null;
  };

  const save = async () => {
    setError('');
    if (!patientName.trim()) { setError('Enter the patient name.'); return; }
    const parsedAge = age.trim() ? Number(age) : undefined;
    setSaving(true);
    try {
      const rx = await addPrescription({
        patientId: matchedPatient?.id,
        patientName: patientName.trim(),
        patientAge: Number.isFinite(parsedAge) ? parsedAge : undefined,
        patientGender: (gender || undefined) as Gender | undefined,
        patientPhone: phone.trim() || undefined,
        patientAddress: address.trim() || undefined,
        doctor: user?.name || undefined,
        date,
        complaint: complaint.trim() || undefined,
        investigation: investigation.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        photos,
      });
      showToast(`Prescription ${rx.id} saved.`);
      resetForm();
      setPreviewRx(rx);
      setTab('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this prescription.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deletePrescription(deleting.id);
      if (previewRx?.id === deleting.id) setPreviewRx(null);
      showToast(`Prescription ${deleting.id} deleted.`);
      setDeleting(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete.', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  // What the Preview tab shows: a pinned saved prescription, else the live form
  // draft, else nothing.
  const draftHasContent =
    patientName.trim().length > 0 ||
    complaint.trim() || investigation.trim() || diagnosis.trim() || photos.length > 0;
  const previewSrc:
    | { patientId: string; date: string; name: string; age: string; sex: string; phone: string; address: string; complaint: string; investigation: string; diagnosis: string; photos: string[] }
    | null =
    previewRx
      ? {
          patientId: previewRx.patientId || '',
          date: previewRx.date,
          name: previewRx.patientName,
          age: previewRx.patientAge != null ? String(previewRx.patientAge) : '',
          sex: previewRx.patientGender || '',
          phone: previewRx.patientPhone || '',
          address: previewRx.patientAddress || '',
          complaint: previewRx.complaint || '',
          investigation: previewRx.investigation || '',
          diagnosis: previewRx.diagnosis || '',
          photos: previewRx.photos || [],
        }
      : draftHasContent
      ? { patientId: matchedPatient?.id || '', date, name: patientName, age, sex: gender, phone, address, complaint, investigation, diagnosis, photos }
      : null;

  // Snapshot the letterhead ℞ to a multi-page A4 PDF (same flow as the bill
  // receipt). Waits for webfonts + the letterhead banners to decode first.
  const handleDownload = async () => {
    const el = receiptRef.current;
    if (!el || downloading || !previewSrc) return;
    setDownloading(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.all(Array.from(el.querySelectorAll('img')).map((img) => img.decode?.().catch(() => {}) ?? Promise.resolve()));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const image = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(image, 'JPEG', margin, position, imgW, imgH);
      heightLeft -= pageH - margin;
      while (heightLeft > 0) {
        position = margin - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const safe = `${previewSrc.patientId || 'draft'}-${previewSrc.name || 'prescription'}`.trim().replace(/[^\w.-]+/g, '-') || 'prescription';
      pdf.save(`${safe}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header no-print">
        <div><p className="eyebrow">Clinical</p><h1>Prescriptions</h1></div>
      </div>

      <div className="rx-tabs-row no-print">
        <div className="rx-tabs">
          <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}><Plus size={15} /> New prescription</button>
          <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}><Eye size={15} /> Preview</button>
          <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}><FileText size={15} /> All Prescription Record</button>
          <button className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
            <Images size={15} /> All Photos{photoCount > 0 && <span className="rx-tab-count">{photoCount}</span>}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { void pickPhotos(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Just-added photos show right here under the buttons, on every tab, so an
          upload is visible the moment it lands. */}
      {photos.length > 0 && tab !== 'photos' && (
        <div className="rx-strip no-print">
          <span className="rx-strip-label">Attached to this prescription · {photos.length}/{MAX_PHOTOS}</span>
          <div className="rx-strip-row">
            {photos.map((src, i) => (
              <div className="rx-thumb" key={i}>
                <button type="button" className="rx-thumb-open" onClick={() => openViewer(draftShots, i)} title="View full size">
                  <img src={src} alt={`Attached photo ${i + 1}`} />
                </button>
                <button type="button" className="rx-thumb-x" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)}><X size={12} /></button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" className="rx-thumb-add" onClick={() => fileInputRef.current?.click()} disabled={photoBusy} title="Add another photo">
                <ImagePlus size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'create' && (
        <section className="card rx-card no-print">
          {error && <div className="modal-error">{error}</div>}
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="rx-patient">Patient name</label>
              <input id="rx-patient" list="rx-known" value={patientName} autoComplete="off"
                onChange={(e) => setPatientName(e.target.value)} placeholder="Type a name…" />
              <datalist id="rx-known">{patients.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            </div>
            <div className="field"><label htmlFor="rx-age">Age</label><input id="rx-age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="34" /></div>
            <div className="field">
              <label htmlFor="rx-sex">Gender</label>
              <select id="rx-sex" value={gender} onChange={(e) => setGender(e.target.value as '' | Gender)}>
                <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="field"><label htmlFor="rx-phone">Phone number</label><input id="rx-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+91 …" /></div>
            <div className="field"><label htmlFor="rx-date">Date</label><input id="rx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="field full"><label htmlFor="rx-address">Address</label><input id="rx-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / street, city" /></div>
            <div className="field full"><label htmlFor="rx-cc">Complaint</label><input id="rx-cc" value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. Fever &amp; body ache for 3 days" /></div>
            <div className="field full"><label htmlFor="rx-ix">Investigation</label><input id="rx-ix" value={investigation} onChange={(e) => setInvestigation(e.target.value)} placeholder="e.g. CBC, CRP, chest X-ray" /></div>
            <div className="field full"><label htmlFor="rx-dx">Diagnosis</label><input id="rx-dx" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Viral fever" /></div>
          </div>

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={resetForm}>Clear</button>
            <button type="button" className="button primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save prescription'}</button>
          </div>
        </section>
      )}

      {tab === 'preview' && (
        <section className="rx-preview-pane">
          {previewSrc ? (
            <>
              <div className="rx-preview-bar no-print">
                {/* <span className="rx-preview-tag">{previewRx ? `${previewRx.id} · ${previewRx.patientName}` : 'Draft — not saved yet'}</span> */}
                <div className="rx-preview-actions">
                  {previewRx && <button type="button" className="button secondary" onClick={() => setPreviewRx(null)}>Preview form draft</button>}
                  <button type="button" className="button secondary" onClick={() => window.print()}><Printer size={14} /> Print</button>
                  <button type="button" className="button primary" onClick={handleDownload} disabled={downloading}><Download size={14} /> {downloading ? '…' : 'Download PDF'}</button>
                </div>
              </div>
              <div className="rx-doc" ref={receiptRef}>
                <img className="rx-lh-band" src="/letterhead-top.jpg" alt="Positive Mind Care and Research Centre" />
                <div className="rx-body">
                  <p className="rx-shloka">सर्वे भवन्तु सुखिनः सर्वे सन्तु निरामयाः</p>
                  <div className="rx-meta">
                    <span>Patient ID: <strong>{previewSrc.patientId || '—'}</strong></span>
                    <span>Date: <strong>{previewSrc.date ? formatDate(previewSrc.date) : '—'}</strong></span>
                  </div>
                  <div className="rx-fields">
                    <span><b>Name:</b> {previewSrc.name || '—'}</span>
                    <span><b>Age:</b> {previewSrc.age.trim() ? previewSrc.age : '—'}</span>
                    <span><b>Gender:</b> {previewSrc.sex || '—'}</span>
                    <span><b>Phone:</b> {previewSrc.phone || '—'}</span>
                  </div>
                  <p className="rx-addr"><b>Address:</b> {previewSrc.address || '—'}</p>
                  {previewSrc.complaint && <p className="rx-dx"><b>Complaint:</b> {previewSrc.complaint}</p>}
                  {previewSrc.investigation && <p className="rx-dx"><b>Investigation:</b> {previewSrc.investigation}</p>}
                  {previewSrc.diagnosis && <p className="rx-dx"><b>Diagnosis:</b> {previewSrc.diagnosis}</p>}
                  <div className="rx-symbol">&#8478;</div>
                  <div className="rx-write" aria-hidden="true" />
                  {previewSrc.photos.length > 0 && (
                    <div className="rx-photos">
                      {previewSrc.photos.map((src, i) => <img key={i} src={src} alt={`Attachment ${i + 1}`} />)}
                    </div>
                  )}
                  <div className="rx-doc-sign"><small>Signature</small></div>
                </div>
                <img className="rx-lh-band rx-lh-bottom" src="/letterhead-bottom.jpg" alt="" />
              </div>
            </>
          ) : (
            <div className="empty-state">Fill the “New prescription” form, or open a record from “All Prescription Record” — its letterhead preview shows here.</div>
          )}
        </section>
      )}

      {tab === 'records' && (
        <section className="card rx-card no-print">
          {prescriptions.length === 0 ? (
            <div className="empty-state">No prescriptions yet. Use “New prescription” to create one.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rx No.</th><th>Date</th><th>Patient name</th><th>Age</th><th>Sex</th><th>Diagnosis</th><th>Photos</th><th></th></tr></thead>
                <tbody>
                  {prescriptions.map((rx) => (
                    <tr key={rx.id}>
                      <td className="customer-name">{rx.id}</td>
                      <td>{formatDate(rx.date)}</td>
                      <td>{rx.patientName}</td>
                      <td>{rx.patientAge ?? '—'}</td>
                      <td>{rx.patientGender ?? '—'}</td>
                      <td>{rx.diagnosis || '—'}</td>
                      <td>
                        {rx.photos && rx.photos.length > 0 ? (
                          <button type="button" className="rx-rec-thumbs" onClick={() => { setPreviewRx(rx); setTab('preview'); }} title={`${rx.photos.length} photo(s) — open`}>
                            {rx.photos.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" />)}
                            {rx.photos.length > 3 && <span>+{rx.photos.length - 3}</span>}
                          </button>
                        ) : '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="row-action" onClick={() => { setPreviewRx(rx); setTab('preview'); }}>Open</button>
                          <button type="button" className="icon-button" aria-label="Delete prescription" onClick={() => setDeleting(rx)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'photos' && (
        <section className="card rx-card no-print">
          <div className="rx-gal-bar">
            <p className="subtitle">Reports and handwritten notes attached to a prescription.</p>
            <button type="button" className="button secondary" onClick={() => fileInputRef.current?.click()} disabled={photoBusy || photos.length >= MAX_PHOTOS}>
              <ImagePlus size={14} /> {photoBusy ? 'Adding…' : 'Add photo'}
            </button>
          </div>
          {photoCount === 0 ? (
            <button type="button" className="rx-gal-drop" onClick={() => fileInputRef.current?.click()} disabled={photoBusy}>
              <ImagePlus size={22} />
              <strong>{photoBusy ? 'Adding…' : 'Add a photo'}</strong>
              <span>Up to {MAX_PHOTOS} photos per prescription. They save with it and print on the letterhead.</span>
            </button>
          ) : (
            <div className="rx-gallery">
              {draftShots.length > 0 && (
                <div className="rx-gal-group">
                  <div className="rx-gal-head">
                    <h3>Current prescription <span>· not saved yet</span></h3>
                    <button type="button" className="row-action" onClick={() => setTab('create')}>Open form</button>
                  </div>
                  <div className="rx-gal-grid">
                    {draftShots.map((shot, i) => (
                      <div className="rx-gal-cell" key={i}>
                        <button type="button" onClick={() => openViewer(draftShots, i)}><img src={shot.src} alt={shot.caption} /></button>
                        <button type="button" className="rx-thumb-x" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)}><X size={12} /></button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button type="button" className="rx-gal-more" onClick={() => fileInputRef.current?.click()} disabled={photoBusy} title="Add another photo">
                        <ImagePlus size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {savedGroups.map(({ rx, shots }) => (
                <div className="rx-gal-group" key={rx.id}>
                  <div className="rx-gal-head">
                    <h3>{rx.id} — {rx.patientName} <span>· {formatDate(rx.date)} · {shots.length} photo{shots.length > 1 ? 's' : ''}</span></h3>
                    <button type="button" className="row-action" onClick={() => { setPreviewRx(rx); setTab('preview'); }}>Open prescription</button>
                  </div>
                  <div className="rx-gal-grid">
                    {shots.map((shot, i) => (
                      <div className="rx-gal-cell" key={i}>
                        <button type="button" onClick={() => openViewer(shots, i)}><img src={shot.src} alt={shot.caption} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {viewer && (
        <div className="rx-viewer" onClick={() => setViewer(null)}>
          <button type="button" className="rx-viewer-x" aria-label="Close" onClick={() => setViewer(null)}><X size={18} /></button>
          {viewer.list.length > 1 && (
            <button type="button" className="rx-viewer-nav left" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); stepViewer(-1); }}><ChevronLeft size={22} /></button>
          )}
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={viewer.list[viewer.index].src} alt={viewer.list[viewer.index].caption} />
            <figcaption>
              {viewer.list[viewer.index].caption}
              {viewer.list.length > 1 && <span> · {viewer.index + 1} of {viewer.list.length}</span>}
            </figcaption>
          </figure>
          {viewer.list.length > 1 && (
            <button type="button" className="rx-viewer-nav right" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); stepViewer(1); }}><ChevronRight size={22} /></button>
          )}
        </div>
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Delete prescription?</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setDeleting(null)}><X size={16} /></button></div>
            <p className="subtitle"><strong style={{ color: 'var(--ink)' }}>{deleting.id}</strong> for {deleting.patientName} will be permanently removed.</p>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button type="button" className="button danger" onClick={confirmDelete} disabled={deleteBusy}><Trash2 size={14} /> {deleteBusy ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .rx-tabs-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .rx-tabs { display: inline-flex; flex-wrap: wrap; gap: 6px; background: var(--surface); border: 1px solid var(--line); border-radius: 11px; padding: 5px; box-shadow: var(--shadow-sm); }
        .rx-tabs button { border: 0; background: transparent; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--muted); display: inline-flex; align-items: center; gap: 7px; }
        .rx-tabs button:hover { color: var(--ink); }
        .rx-tabs button.active { background: var(--primary-soft); color: var(--primary); }
        .rx-tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--primary); color: #fff; font-size: 10.5px; font-weight: 800; }

        .rx-strip { display: flex; flex-direction: column; gap: 8px; margin: -8px 0 20px; }
        .rx-strip-label { font-size: 11.5px; font-weight: 700; color: var(--muted); }
        .rx-strip-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .rx-thumb { position: relative; }
        .rx-thumb-open { border: 0; padding: 0; background: transparent; cursor: zoom-in; display: block; }
        .rx-thumb-open img { width: 76px; height: 76px; object-fit: cover; border-radius: 9px; border: 1px solid var(--line); box-shadow: var(--shadow-sm); display: block; background: #fff; }
        .rx-thumb-open:hover img { border-color: var(--primary); }
        .rx-thumb-x { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0; box-shadow: var(--shadow-sm); cursor: pointer; }
        .rx-thumb-x:hover { border-color: #dc2626; color: #dc2626; }
        .rx-thumb-add { width: 76px; height: 76px; border: 1px dashed var(--line); border-radius: 9px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .rx-thumb-add:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .rx-thumb-add:disabled { opacity: .6; }

        .rx-gal-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .rx-gal-bar .subtitle { margin: 0; }
        .rx-gal-drop { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 38px 20px; border: 1px dashed var(--line); border-radius: 12px; background: transparent; color: var(--muted); cursor: pointer; }
        .rx-gal-drop strong { font-size: 13.5px; color: var(--ink); }
        .rx-gal-drop span { font-size: 12px; max-width: 380px; text-align: center; }
        .rx-gal-drop:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .rx-gal-drop:hover:not(:disabled) strong { color: var(--primary); }
        .rx-gal-more { height: 140px; border: 1px dashed var(--line); border-radius: 10px; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .rx-gal-more:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .rx-gallery { display: flex; flex-direction: column; gap: 22px; }
        .rx-gal-group { display: flex; flex-direction: column; gap: 10px; }
        .rx-gal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
        .rx-gal-head h3 { margin: 0; font-size: 13px; font-weight: 800; color: var(--ink); }
        .rx-gal-head h3 span { font-weight: 600; color: var(--muted); }
        .rx-gal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
        .rx-gal-cell { position: relative; }
        .rx-gal-cell > button:first-child { border: 0; padding: 0; background: transparent; cursor: zoom-in; display: block; width: 100%; }
        .rx-gal-cell img { width: 100%; height: 140px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); background: #fff; display: block; }
        .rx-gal-cell > button:first-child:hover img { border-color: var(--primary); }

        .rx-viewer { position: fixed; inset: 0; z-index: 80; background: rgba(15, 23, 42, .82); display: flex; align-items: center; justify-content: center; padding: 32px 56px; }
        .rx-viewer figure { margin: 0; max-width: 100%; max-height: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .rx-viewer img { max-width: 100%; max-height: calc(100vh - 130px); object-fit: contain; border-radius: 10px; background: #fff; }
        .rx-viewer figcaption { font-size: 12px; font-weight: 700; color: #fff; text-align: center; }
        .rx-viewer figcaption span { font-weight: 500; opacity: .75; }
        .rx-viewer-x { position: absolute; top: 18px; right: 18px; width: 34px; height: 34px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .16); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .rx-viewer-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .16); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .rx-viewer-nav:hover, .rx-viewer-x:hover { background: rgba(255, 255, 255, .3); }
        .rx-viewer-nav.left { left: 12px; }
        .rx-viewer-nav.right { right: 12px; }
        .rx-card { padding: 22px; }

        .rx-rec-thumbs { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; padding: 0; cursor: pointer; }
        .rx-rec-thumbs img { width: 30px; height: 30px; object-fit: cover; border-radius: 5px; border: 1px solid var(--line); display: block; }
        .rx-rec-thumbs span { font-size: 11px; font-weight: 700; color: var(--muted); }

        .rx-preview-pane { max-width: 760px; }
        .rx-preview-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .rx-preview-tag { font-size: 12px; font-weight: 700; color: var(--muted); }
        .rx-preview-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        .rx-doc { background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 760px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .rx-lh-band { display: block; width: 100%; height: auto; }
        .rx-lh-bottom { margin-top: auto; }
        .rx-body { padding: 16px 32px 26px; }
        .rx-shloka { text-align: center; font-size: 11px; color: var(--primary); font-style: italic; margin: 0 0 12px; }
        .rx-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2px 16px; font-size: 12px; color: var(--muted); padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1.5px solid var(--primary); }
        .rx-meta strong { color: var(--ink); }
        .rx-fields { display: flex; flex-wrap: wrap; gap: 4px 24px; font-size: 13px; margin-bottom: 8px; }
        .rx-fields b, .rx-dx b, .rx-addr b { color: var(--muted); font-weight: 700; margin-right: 4px; }
        .rx-dx, .rx-addr { font-size: 12.5px; margin: 0 0 6px; }
        .rx-symbol { font: 700 24px 'Space Grotesk', serif; color: var(--primary); margin: 10px 0 0; border-top: 1.5px solid var(--primary); padding-top: 8px; }
        /* Blank room under the ℞ — medicines are written in by hand on the print. */
        .rx-write { min-height: 300px; }
        .rx-photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 14px 0 0; }
        .rx-photos img { width: 100%; max-height: 260px; object-fit: contain; border: 1px solid var(--line); border-radius: 6px; background: #fff; break-inside: avoid; }
        .rx-doc-sign { margin-top: 40px; text-align: right; font-weight: 700; font-family: 'Space Grotesk', sans-serif; font-size: 13px; }
        .rx-doc-sign small { display: block; width: 168px; margin: 6px 0 0 auto; font-weight: 400; color: var(--muted); font-size: 10px; border-top: 1px solid var(--line); padding-top: 4px; }

        @media print {
          .rx-preview-pane { max-width: none; }
          .rx-doc { border: none; border-radius: 0; min-height: 0; }
        }
        @media (max-width: 560px) {
          .rx-tabs-row { width: 100%; }
          .rx-tabs { display: flex; width: 100%; }
          .rx-tabs button { flex: 1 1 auto; justify-content: center; padding: 9px 8px; }
          .rx-gal-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
          .rx-viewer { padding: 20px 12px 56px; }
          .rx-viewer-nav.left { left: 6px; }
          .rx-viewer-nav.right { right: 6px; }
          .rx-photos { grid-template-columns: 1fr; }
          .rx-body { padding: 12px 16px 20px; }
        }
      `}</style>
    </div>
  );
}
