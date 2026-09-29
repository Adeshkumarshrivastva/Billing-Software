import type { Bill, BillItem, ClinicProfile, Patient, Prescription, ServiceItem } from './types';

export const seedProfile: ClinicProfile = {
  name: 'PMC Care Clinic',
  tagline: 'Tech Billing Software',
  email: 'accounts@pmcclinic.in',
  phone: '+91 98765 43210',
  registrationNo: 'MH/CLINIC/2019/04471',
  address: 'Shivaji Nagar, Pune, Maharashtra 411005',
  currency: 'INR',
  billPrefix: 'BILL-',
  nextBillSeq: 1049,
  upiVpa: 'pmccare@hdfcbank',
  upiName: 'PMC Care Clinic',
};

// All demo dates are computed relative to the moment the seed runs, so the
// sample data always lands on recent days instead of being frozen on fixed
// calendar dates. `daysAgo(0)` is today. Real records created through the app
// already save with their own real date/createdAt — this only affects the
// throwaway demo set inserted by `npm run seed`.
const SEED_NOW = Date.now();
const DAY_MS = 86_400_000;
/** Full ISO timestamp for a point N days before the seed run. */
const stampDaysAgo = (days: number) => new Date(SEED_NOW - days * DAY_MS).toISOString();
/** yyyy-mm-dd for a point N days before the seed run (matches todayISO()). */
const dateDaysAgo = (days: number) => stampDaysAgo(days).slice(0, 10);

export const seedPatients: Patient[] = [
  { id: 'PAT-0001', name: 'Maya Patel', age: 34, gender: 'Female', phone: '+91 90000 11111', email: 'maya@example.com', address: 'Kothrud, Pune', date: dateDaysAgo(86), status: 'Active', createdAt: stampDaysAgo(86) },
  { id: 'PAT-0002', name: 'Jon Bell', age: 45, gender: 'Male', phone: '+91 90000 22222', email: 'jon@example.com', address: 'Baner, Pune', date: dateDaysAgo(70), status: 'Active', createdAt: stampDaysAgo(70) },
  { id: 'PAT-0003', name: 'Priya Deshmukh', age: 7, gender: 'Female', phone: '+91 90000 33333', guardianName: 'Rahul Deshmukh', address: 'Aundh, Pune', date: dateDaysAgo(7), status: 'Active', createdAt: stampDaysAgo(7) },
  { id: 'PAT-0004', name: 'Ari Singh', age: 61, gender: 'Male', phone: '+91 90000 44444', email: 'ari@example.com', address: 'Viman Nagar, Pune', date: dateDaysAgo(47), status: 'Active', createdAt: stampDaysAgo(47) },
  { id: 'PAT-0005', name: 'Sunita Kulkarni', age: 52, gender: 'Female', phone: '+91 90000 55555', address: 'Camp, Pune', date: dateDaysAgo(112), status: 'Inactive', createdAt: stampDaysAgo(112) },
];

export const seedServices: ServiceItem[] = [
  { id: 'SVC-0001', name: 'General Consultation', category: 'Consultation', price: 500 },
  { id: 'SVC-0002', name: 'Cardiology Consultation', category: 'Consultation', price: 900 },
  { id: 'SVC-0003', name: 'Complete Blood Count (CBC)', category: 'Lab Test', price: 350 },
  { id: 'SVC-0004', name: 'X-Ray (Single View)', category: 'Lab Test', price: 450 },
  { id: 'SVC-0005', name: 'Minor Dressing Procedure', category: 'Procedure', price: 300 },
  { id: 'SVC-0006', name: 'General Ward — Per Day', category: 'Room Charges', price: 1200 },
  { id: 'SVC-0007', name: 'Paracetamol 650mg (Strip of 10)', category: 'Pharmacy', price: 28 },
];

function buildBill(input: {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctor?: string;
  date: string;
  items: BillItem[];
  discount?: number;
  paidAmount: number;
  paymentMode: Bill['paymentMode'];
  createdAt: string;
  notes?: string;
}): Bill {
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const discount = input.discount ?? 0;
  const amount = Math.max(0, subtotal - discount);
  const status: Bill['status'] = input.paidAmount >= amount ? 'Paid' : 'Pending';
  return { id: input.id, patientId: input.patientId, patientName: input.patientName, patientPhone: input.patientPhone, doctor: input.doctor, date: input.date, items: input.items, subtotal, discount, amount, paidAmount: input.paidAmount, status, paymentMode: input.paymentMode, notes: input.notes, createdAt: input.createdAt };
}

export const seedBills: Bill[] = [
  buildBill({ id: 'BILL-1048', patientId: 'PAT-0001', patientName: 'Maya Patel', patientPhone: '+91 90000 11111', doctor: 'Dr. Anita Rao', date: dateDaysAgo(0), createdAt: stampDaysAgo(0), paidAmount: 500, paymentMode: 'UPI', items: [{ serviceId: 'SVC-0001', service: 'General Consultation', category: 'Consultation', quantity: 1, price: 500 }] }),
  buildBill({ id: 'BILL-1047', patientId: 'PAT-0002', patientName: 'Jon Bell', patientPhone: '+91 90000 22222', doctor: 'Dr. Vikram Shah', date: dateDaysAgo(2), createdAt: stampDaysAgo(2), paidAmount: 0, paymentMode: 'Cash', items: [{ serviceId: 'SVC-0002', service: 'Cardiology Consultation', category: 'Consultation', quantity: 1, price: 900 }, { serviceId: 'SVC-0003', service: 'Complete Blood Count (CBC)', category: 'Lab Test', quantity: 1, price: 350 }] }),
  buildBill({ id: 'BILL-1046', patientId: 'PAT-0003', patientName: 'Priya Deshmukh', patientPhone: '+91 90000 33333', doctor: 'Dr. Anita Rao', date: dateDaysAgo(7), createdAt: stampDaysAgo(7), paidAmount: 300, discount: 50, paymentMode: 'Card', items: [{ serviceId: 'SVC-0001', service: 'General Consultation', category: 'Consultation', quantity: 1, price: 500 }, { serviceId: 'SVC-0007', service: 'Paracetamol 650mg (Strip of 10)', category: 'Pharmacy', quantity: 2, price: 28 }] }),
  buildBill({ id: 'BILL-1045', patientId: 'PAT-0004', patientName: 'Ari Singh', patientPhone: '+91 90000 44444', doctor: 'Dr. Vikram Shah', date: dateDaysAgo(14), createdAt: stampDaysAgo(14), paidAmount: 1200, paymentMode: 'Insurance', items: [{ serviceId: 'SVC-0006', service: 'General Ward — Per Day', category: 'Room Charges', quantity: 2, price: 1200 }] }),
  buildBill({ id: 'BILL-1044', patientId: 'PAT-0005', patientName: 'Sunita Kulkarni', patientPhone: '+91 90000 55555', doctor: 'Dr. Anita Rao', date: dateDaysAgo(30), createdAt: stampDaysAgo(30), paidAmount: 750, paymentMode: 'UPI', items: [{ serviceId: 'SVC-0004', service: 'X-Ray (Single View)', category: 'Lab Test', quantity: 1, price: 450 }, { serviceId: 'SVC-0005', service: 'Minor Dressing Procedure', category: 'Procedure', quantity: 1, price: 300 }] }),
];

export const seedPrescriptions: Prescription[] = [
  {
    id: 'RX-0001', patientId: 'PAT-0001', patientName: 'Maya Patel', patientAge: 34, patientGender: 'Female',
    patientPhone: '+91 90000 11111', patientAddress: 'Kothrud, Pune', doctor: 'Dr. Anita Rao',
    date: dateDaysAgo(0), diagnosis: 'Acute viral fever', createdAt: stampDaysAgo(0),
    items: [
      { name: 'Paracetamol 500 mg', dose: '1 tablet', frequency: '1-1-1', timing: 'After food', duration: '3 days', notes: 'For fever above 100°F' },
      { name: 'Cetirizine 10 mg', dose: '1 tablet', frequency: '0-0-1', timing: 'At bedtime', duration: '5 days', notes: '' },
      { name: 'ORS sachet', dose: '1 sachet', frequency: 'SOS', timing: 'With food', duration: '3 days', notes: 'One sachet in 1L water' },
    ],
    advice: 'Rest, plenty of fluids. Review if fever persists beyond 3 days.', followUpDate: dateDaysAgo(-3),
  },
  {
    id: 'RX-0002', patientId: 'PAT-0002', patientName: 'Jon Bell', patientAge: 45, patientGender: 'Male',
    patientPhone: '+91 90000 22222', patientAddress: 'Baner, Pune', doctor: 'Dr. Vikram Shah',
    date: dateDaysAgo(2), diagnosis: 'Hypertension — routine review', createdAt: stampDaysAgo(2),
    items: [
      { name: 'Amlodipine 5 mg', dose: '1 tablet', frequency: '1-0-0', timing: 'Before food', duration: '30 days', notes: 'Check BP weekly' },
      { name: 'Pantoprazole 40 mg', dose: '1 tablet', frequency: '1-0-0', timing: 'Empty stomach', duration: '15 days', notes: '' },
    ],
    advice: 'Low-salt diet, 30 min walk daily. Repeat lipid profile before next visit.', followUpDate: dateDaysAgo(-28),
  },
  {
    id: 'RX-0003', patientId: 'PAT-0004', patientName: 'Ari Singh', patientAge: 61, patientGender: 'Male',
    patientPhone: '+91 90000 44444', patientAddress: 'Viman Nagar, Pune', doctor: 'Dr. Vikram Shah',
    date: dateDaysAgo(14), diagnosis: 'Lower respiratory tract infection', createdAt: stampDaysAgo(14),
    items: [
      { name: 'Azithromycin 500 mg', dose: '1 tablet', frequency: '1-0-0', timing: 'After food', duration: '5 days', notes: '' },
      { name: 'Pantoprazole 40 mg', dose: '1 tablet', frequency: '1-0-0', timing: 'Empty stomach', duration: '5 days', notes: '' },
      { name: 'Paracetamol 500 mg', dose: '1 tablet', frequency: 'SOS', timing: 'After food', duration: '3 days', notes: 'If fever or body ache' },
    ],
    advice: 'Steam inhalation twice daily. Return immediately if breathlessness worsens.', followUpDate: '',
  },
];
