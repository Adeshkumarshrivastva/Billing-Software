'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatCurrency as formatCurrencyBase } from './format';
import { flashToast } from './toast';
import type { Bill, ClinicProfile, Patient, PaymentMode, Prescription, ServiceCategory, ServiceItem } from './types';

export type CurrentUser = { name: string; email: string; phone: string; role: 'admin' | 'user' };

export type PatientWithStats = Patient & { totalBilled: number; visitCount: number; lastVisit: string | null };
export type ServiceWithStats = ServiceItem & { timesBilled: number };

type NewPatientInput = { name: string; age?: number; gender?: Patient['gender']; phone?: string; email?: string; address?: string; guardianName?: string; date?: string };
type PatientEditInput = Partial<Pick<Patient, 'name' | 'age' | 'gender' | 'phone' | 'email' | 'address' | 'guardianName' | 'status' | 'date'>>;
type NewServiceInput = { name: string; category: ServiceCategory; price: number };
type ServiceEditInput = Partial<Pick<ServiceItem, 'name' | 'category' | 'price'>>;
// Bill to a patient either by existing id, or by typing a name directly (a new
// patient is created on the spot if the name doesn't match anyone registered).
// `id` lets the bill number be typed manually instead of auto-assigned.
type NewBillInput = { id?: string; patientId?: string; patientName?: string; patientPhone?: string; doctor?: string; date: string; items: Array<{ serviceId: string; quantity: number }>; discount?: number; paidAmount?: number; paymentMode: PaymentMode; paymentTxnId?: string; notes?: string };
// Prescribe to a patient by existing id or by typed name — a new patient is
// registered on the spot when the name matches nobody, exactly like billing.
type NewPrescriptionInput = {
  id?: string;
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: Patient['gender'];
  patientAddress?: string;
  doctor?: string;
  date: string;
  complaint?: string;
  investigation?: string;
  diagnosis?: string;
  items?: Array<{ name: string; dose?: string; frequency?: string; timing?: string; duration?: string; notes?: string }>;
  note?: string;
  photos?: string[];
  advice?: string;
  followUpDate?: string;
};

type BillingState = {
  patients: PatientWithStats[];
  services: ServiceWithStats[];
  bills: Bill[];
  prescriptions: Prescription[];
  profile: ClinicProfile;
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  nextBillNumber: string;
  formatCurrency: (value: number) => string;
  addPatient: (input: NewPatientInput) => Promise<Patient>;
  updatePatient: (id: string, patch: PatientEditInput) => Promise<Patient>;
  addService: (input: NewServiceInput) => Promise<ServiceItem>;
  updateService: (id: string, patch: ServiceEditInput) => Promise<ServiceItem>;
  deleteService: (id: string) => Promise<void>;
  addBill: (input: NewBillInput) => Promise<Bill>;
  addPrescription: (input: NewPrescriptionInput) => Promise<Prescription>;
  deletePrescription: (id: string) => Promise<void>;
  recordPayment: (billId: string, paidAmount: number, paymentTxnId?: string) => Promise<Bill>;
  updateProfile: (patch: Partial<ClinicProfile>) => Promise<ClinicProfile>;
  logout: () => Promise<void>;
};

const BillingContext = createContext<BillingState | null>(null);

const emptyProfile: ClinicProfile = { name: '', tagline: '', email: '', phone: '', registrationNo: '', address: '', currency: 'INR', billPrefix: 'BILL-', nextBillSeq: 1001, upiVpa: '', upiName: '' };

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request to ${url} failed (${res.status}).`);
  return body as T;
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // /login and /register are reachable while signed out — every other route
  // is already gated by middleware, so it's pointless (and noisy) to fetch here.
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [profile, setProfile] = useState<ClinicProfile>(emptyProfile);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(!isAuthPage);
  const [error, setError] = useState<string | null>(null);

  const refetchProfile = async () => setProfile(await apiFetch<ClinicProfile>('/api/profile'));

  useEffect(() => {
    if (isAuthPage) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [patientsRes, servicesRes, billsRes, prescriptionsRes, profileRes, meRes] = await Promise.all([
          apiFetch<Patient[]>('/api/patients'),
          apiFetch<ServiceItem[]>('/api/services'),
          apiFetch<Bill[]>('/api/bills'),
          apiFetch<Prescription[]>('/api/prescriptions'),
          apiFetch<ClinicProfile>('/api/profile'),
          apiFetch<CurrentUser>('/api/auth/me'),
        ]);
        if (cancelled) return;
        setPatients(patientsRes);
        setServices(servicesRes);
        setBills(billsRes);
        setPrescriptions(prescriptionsRes);
        setProfile(profileRes);
        setUser(meRes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not reach the API.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthPage]);

  const patientsWithStats = useMemo<PatientWithStats[]>(() => {
    return patients.map((patient) => {
      const own = bills.filter((bill) => bill.patientId === patient.id);
      const totalBilled = own.reduce((sum, bill) => sum + bill.amount, 0);
      const lastVisit = own.reduce<string | null>((latest, bill) => (!latest || bill.date > latest ? bill.date : latest), null);
      return { ...patient, totalBilled, visitCount: own.length, lastVisit };
    });
  }, [patients, bills]);

  const servicesWithStats = useMemo<ServiceWithStats[]>(() => {
    return services.map((service) => {
      const timesBilled = bills.reduce((sum, bill) => sum + bill.items.filter((item) => item.serviceId === service.id).reduce((s, item) => s + item.quantity, 0), 0);
      return { ...service, timesBilled };
    });
  }, [services, bills]);

  const addPatient: BillingState['addPatient'] = async (input) => {
    const patient = await apiFetch<Patient>('/api/patients', { method: 'POST', body: JSON.stringify(input) });
    setPatients((prev) => [patient, ...prev]);
    return patient;
  };

  const updatePatient: BillingState['updatePatient'] = async (id, patch) => {
    const updated = await apiFetch<Patient>(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const addService: BillingState['addService'] = async (input) => {
    const service = await apiFetch<ServiceItem>('/api/services', { method: 'POST', body: JSON.stringify(input) });
    setServices((prev) => [service, ...prev]);
    return service;
  };

  const updateService: BillingState['updateService'] = async (id, patch) => {
    const updated = await apiFetch<ServiceItem>(`/api/services/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
    setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  };

  const deleteService: BillingState['deleteService'] = async (id) => {
    await apiFetch(`/api/services/${id}`, { method: 'DELETE' });
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const addBill: BillingState['addBill'] = async (input) => {
    // Resolve the patient: use the id if given, otherwise match the typed name
    // against the register — and if nobody matches, register them on the spot so
    // the bill always links to a real patient record.
    let patientId = input.patientId;
    if (!patientId && input.patientName?.trim()) {
      const typed = input.patientName.trim();
      const match = patients.find((p) => p.name.trim().toLowerCase() === typed.toLowerCase());
      patientId = match ? match.id : (await addPatient({ name: typed, phone: input.patientPhone?.trim() || undefined })).id;
    }
    const bill = await apiFetch<Bill>('/api/bills', { method: 'POST', body: JSON.stringify({ ...input, patientId }) });
    setBills((prev) => [bill, ...prev]);
    await refetchProfile(); // nextBillSeq moved forward server-side
    return bill;
  };

  const addPrescription: BillingState['addPrescription'] = async (input) => {
    // Same patient resolution as billing: use the id, else match the typed name,
    // else register the walk-in on the spot so the Rx always links to a record.
    let patientId = input.patientId;
    if (!patientId && input.patientName?.trim()) {
      const typed = input.patientName.trim();
      const match = patients.find((p) => p.name.trim().toLowerCase() === typed.toLowerCase());
      patientId = match
        ? match.id
        : (await addPatient({
            name: typed,
            phone: input.patientPhone?.trim() || undefined,
            age: input.patientAge,
            gender: input.patientGender,
            address: input.patientAddress?.trim() || undefined,
          })).id;
    }
    const prescription = await apiFetch<Prescription>('/api/prescriptions', { method: 'POST', body: JSON.stringify({ ...input, patientId }) });
    setPrescriptions((prev) => [prescription, ...prev]);
    return prescription;
  };

  const deletePrescription: BillingState['deletePrescription'] = async (id) => {
    await apiFetch(`/api/prescriptions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setPrescriptions((prev) => prev.filter((rx) => rx.id !== id));
  };

  const recordPayment: BillingState['recordPayment'] = async (billId, paidAmount, paymentTxnId) => {
    const bill = await apiFetch<Bill>(`/api/bills/${encodeURIComponent(billId)}`, { method: 'PUT', body: JSON.stringify({ paidAmount, paymentTxnId }) });
    setBills((prev) => prev.map((b) => (b.id === billId ? bill : b)));
    return bill;
  };

  const updateProfile: BillingState['updateProfile'] = async (patch) => {
    const next = await apiFetch<ClinicProfile>('/api/profile', { method: 'PUT', body: JSON.stringify(patch) });
    setProfile(next);
    return next;
  };

  const logout: BillingState['logout'] = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    flashToast('Signed out successfully.');
    window.location.href = '/login';
  };

  const value: BillingState = {
    patients: patientsWithStats,
    services: servicesWithStats,
    bills,
    prescriptions,
    profile,
    user,
    loading,
    error,
    nextBillNumber: `${profile.billPrefix}${profile.nextBillSeq}`,
    formatCurrency: (value: number) => formatCurrencyBase(value, profile.currency),
    addPatient,
    updatePatient,
    addService,
    updateService,
    deleteService,
    addBill,
    addPrescription,
    deletePrescription,
    recordPayment,
    updateProfile,
    logout,
  };

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within a BillingProvider');
  return ctx;
}
