'use client';
import { PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/lib/types';
import { useBilling, type ServiceWithStats } from '@/lib/store';
import { useToast } from '@/lib/toast';

const PACKAGE_OPTIONS = [
  { name: 'Essential', price: 3000 },
  { name: 'Growth', price: 4000 },
  { name: 'Advanced', price: 7000 },
] as const;

export default function ServicesPage() {
  const { services, addService, updateService, deleteService, formatCurrency, profile, loading } = useBilling();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newServiceCategory, setNewServiceCategory] = useState<ServiceCategory>('Consultation');
  const [newPackageSelection, setNewPackageSelection] = useState<string>('Essential');

  const [editing, setEditing] = useState<ServiceWithStats | null>(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editCategory, setEditCategory] = useState<ServiceCategory>('Consultation');
  const [editPackageSelection, setEditPackageSelection] = useState<string>('Essential');

  const [deleting, setDeleting] = useState<ServiceWithStats | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);

  const filtered = services.filter((service) => `${service.name} ${service.category}`.toLowerCase().includes(query.toLowerCase()));

  const packagePrice = (label: string) => PACKAGE_OPTIONS.find((option) => option.name === label)?.price ?? 3000;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = newServiceCategory;

    let name = String(form.get('name') || '').trim();
    let price = Math.round(Number(form.get('price')));

    if (category === 'Package') {
      name = newPackageSelection;
      price = packagePrice(newPackageSelection);
    }

    if (!name || !Number.isFinite(price) || price < 0) { setError('Name and a valid price are required.'); return; }
    setSaving(true);
    try {
      await addService({ name, category, price });
      setOpen(false);
      setNewServiceCategory('Consultation');
      setNewPackageSelection('Essential');
      setError('');
      showToast('Service added successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this service.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const category = editCategory;

    let name = String(form.get('name') || '').trim();
    let price = Math.round(Number(form.get('price')));

    if (category === 'Package') {
      name = editPackageSelection;
      price = packagePrice(editPackageSelection);
    }

    if (!name || !Number.isFinite(price) || price < 0) { setEditError('Name and a valid price are required.'); return; }
    setEditSaving(true);
    try {
      await updateService(editing.id, { name, category, price });
      setEditing(null);
      setEditError('');
      showToast('Service updated successfully.');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await deleteService(deleting.id);
      setDeleting(null);
      setDeleteError('');
      showToast('Service removed from the catalog.');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not remove this service.');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><p className="eyebrow">Catalog</p><h1>Services</h1><p className="subtitle">Consultations, tests, procedures and charges you bill patients for.</p></div>
        <button className="button primary" onClick={() => setOpen(true)}><Plus size={16} /> Add service</button>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" /></div>
      </div>
      <section className="card section-card">
        <div className="section-heading">
          <div><h2>Your catalog</h2><p className="subtitle" style={{ marginTop: 5 }}>{services.length} items · prices in {profile.currency}</p></div>
          <button className="icon-button" aria-label="Add service" onClick={() => setOpen(true)}><PackagePlus size={17} /></button>
        </div>
        <div className="product-list">
          {filtered.map((service) => (
            <div className="product-row" key={service.id}>
              <div>
                <h3>{service.name}</h3>
                <div className="product-sku"><span className="category-chip">{service.category}</span></div>
              </div>
              <div className="row-actions">
                <span className="price">{formatCurrency(service.price)}</span>
                <button className="icon-button" aria-label="Edit service" onClick={() => { setEditing(service); setEditCategory(service.category); setEditPackageSelection(service.category === 'Package' ? service.name : 'Essential'); setEditError(''); }}><Pencil size={14} /></button>
                <button className="icon-button" aria-label="Delete service" onClick={() => { setDeleting(service); setDeleteError(''); }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div className="empty-state">No services match that search.</div>}
        </div>
      </section>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <form className="card modal-card" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
            <div className="modal-head"><h2>Add service</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={16} /></button></div>
            {error && <div className="modal-error">{error}</div>}
            <div className="form-grid">
              {!open && null}
              {newServiceCategory !== 'Package' && <div className="field full"><label htmlFor="s-name">Name</label><input id="s-name" name="name" required placeholder="ECG" /></div>}
              {newServiceCategory === 'Package' && (
                <div className="field full">
                  <label htmlFor="s-package">Package option</label>
                  <select id="s-package" value={newPackageSelection} onChange={(event) => setNewPackageSelection(event.target.value)}>
                    {PACKAGE_OPTIONS.map((option) => <option key={option.name} value={option.name}>{option.name} · {formatCurrency(option.price)}</option>)}
                  </select>
                </div>
              )}
              <div className="field"><label htmlFor="s-category">Category</label><select id="s-category" name="category" value={newServiceCategory} onChange={(event) => setNewServiceCategory(event.target.value as ServiceCategory)}>{SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              {newServiceCategory !== 'Package' && <div className="field full"><label htmlFor="s-price">Price ({profile.currency})</label><input id="s-price" name="price" type="number" min="0" step="1" required placeholder="500" /></div>}
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save service'}</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <form className="card modal-card" onClick={(event) => event.stopPropagation()} onSubmit={handleEditSubmit}>
            <div className="modal-head"><h2>Edit service</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><X size={16} /></button></div>
            {editError && <div className="modal-error">{editError}</div>}
            <div className="form-grid">
              {editCategory !== 'Package' && <div className="field full"><label htmlFor="edit-s-name">Name</label><input id="edit-s-name" name="name" required defaultValue={editing.name} /></div>}
              {editCategory === 'Package' && (
                <div className="field full">
                  <label htmlFor="edit-s-package">Package option</label>
                  <select id="edit-s-package" value={editPackageSelection} onChange={(event) => setEditPackageSelection(event.target.value)}>
                    {PACKAGE_OPTIONS.map((option) => <option key={option.name} value={option.name}>{option.name} · {formatCurrency(option.price)}</option>)}
                  </select>
                </div>
              )}
              <div className="field"><label htmlFor="edit-s-category">Category</label><select id="edit-s-category" name="category" value={editCategory} onChange={(event) => setEditCategory(event.target.value as ServiceCategory)}>{SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              {editCategory !== 'Package' && <div className="field full"><label htmlFor="edit-s-price">Price ({profile.currency})</label><input id="edit-s-price" name="price" type="number" min="0" step="1" required defaultValue={editing.price} /></div>}
            </div>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="button primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="modal-overlay" onClick={() => setDeleting(null)}>
          <div className="card modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><h2>Remove service?</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setDeleting(null)}><X size={16} /></button></div>
            {deleteError && <div className="modal-error">{deleteError}</div>}
            <p className="subtitle">
              <strong style={{ color: 'var(--ink)' }}>{deleting.name}</strong> will be removed from the catalog. Bills that already used it keep their own price snapshot, so past bills aren&apos;t affected.
            </p>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button type="button" className="button danger" onClick={confirmDelete} disabled={deleteSaving}><Trash2 size={14} /> {deleteSaving ? 'Removing…' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
