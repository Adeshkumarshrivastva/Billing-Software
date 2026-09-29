// Domain types for the PMC patient billing workspace.
// Healthcare services are GST-exempt in India, so there is deliberately no
// tax logic anywhere in this app — patient bills are just services + discount.

export type Gender = 'Male' | 'Female' | 'Other';

export type Patient = {
  id: string; // e.g. PAT-0001, doubles as the MRN (medical record number)
  name: string;
  // Optional: a patient can be created inline from the billing screen with just a
  // name, so age/gender/phone aren't guaranteed — the registration form still asks.
  age?: number;
  gender?: Gender;
  phone?: string;
  email?: string;
  address?: string;
  guardianName?: string; // for minors / dependents
  date?: string; // yyyy-mm-dd registration date — shown as dd-mm-yyyy. Optional
                 // because inline-created (billing screen) / legacy records
                 // may only have `createdAt`; UI falls back to that.
  status: 'Active' | 'Inactive';
  createdAt: string; // ISO timestamp
};

export type ServiceCategory = 'Consultation' | 'Lab Test' | 'Procedure' | 'Room Charges' | 'Pharmacy' | 'Package' | 'Other';

export const SERVICE_CATEGORIES: ServiceCategory[] = ['Consultation', 'Lab Test', 'Procedure', 'Room Charges', 'Pharmacy', 'Package', 'Other'];

export type ServiceItem = {
  id: string; // e.g. SVC-001
  name: string;
  category: ServiceCategory;
  price: number;
};

export type PaymentMode = 'Cash' | 'Card' | 'UPI' | 'Insurance';

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Card', 'UPI', 'Insurance'];

export type UpiApp = 'PhonePe' | 'Google Pay' | 'Paytm' | 'BHIM' | 'Other';

export const UPI_APPS: UpiApp[] = ['PhonePe', 'Google Pay', 'Paytm', 'BHIM', 'Other'];

export type CardBrand = 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Discover' | 'Card';

export type PaymentStatus = 'success' | 'failed' | 'pending';

// A single collection attempt. Card data is deliberately reduced to gateway
// references; the full PAN and CVV never reach the server or database.
export type Payment = {
  id: string; // TXN-XXXXXXXX
  billId?: string;
  billNo?: string;
  patientName?: string;
  address?: string;
  method: PaymentMode;
  amount: number;
  status: PaymentStatus;
  sandbox: boolean;
  reference?: string; // approval code / RRN / UTR
  createdAt: string;
  // What the kiosk machine reported back about the card it read. The number,
  // expiry and CVV stay on the terminal and never reach this app.
  cardBrand?: CardBrand;
  cardLast4?: string;
  cardHolder?: string;
  cardType?: string; // CREDIT / DEBIT, as printed on the slip
  kioskProvider?: string; // 'manual' | 'http'
  kioskTerminalId?: string;
  kioskRefId?: string; // what the terminal calls this charge
  kioskApprovalCode?: string; // auth code on the slip
  upiApp?: UpiApp;
  upiId?: string;
  upiUri?: string; // upi://pay?... used to render the QR
};

export type BillStatus = 'Pending' | 'Paid';

export type BillItem = {
  serviceId: string;
  service: string;
  category: ServiceCategory;
  quantity: number;
  price: number; // unit price snapshotted at billing time
};

export type Bill = {
  id: string; // e.g. BILL-1001
  patientId: string;
  patientName: string;
  patientPhone?: string;
  doctor?: string;
  date: string; // ISO yyyy-mm-dd, visit/bill date
  items: BillItem[];
  subtotal: number;
  discount: number; // flat amount
  amount: number; // subtotal - discount
  paidAmount: number;
  status: BillStatus;
  paymentMode: PaymentMode;
  payment?: Payment; // the collection captured for this bill, if any
  notes?: string;
  createdAt: string;
};

// ─── Prescriptions ───────────────────────────────────────────────────────────
// A doctor prescribes one or more medicines to a patient. No pricing here — a
// prescription is a clinical document, not a bill; the pharmacy bills separately
// through Services if the patient buys the medicines on-site.

// `items` is kept on the type so prescriptions saved before the medicine table
// was dropped still load and validate; nothing writes it any more.
export type PrescriptionItem = {
  name: string;
  dose: string;      // how much per intake, e.g. "1 tablet", "5 ml", "½ tab"
  frequency: string; // dosing pattern, e.g. "1-0-1"
  timing: string;    // food timing, e.g. "After food"
  duration: string;  // free text, e.g. "5 days"
  notes: string;
};

export type Prescription = {
  id: string; // RX-0001
  patientId: string;
  patientName: string;
  // Snapshotted from the patient record at prescribing time, but editable per Rx
  // (a walk-in without a full record can still be prescribed to).
  patientAge?: number;
  patientGender?: Gender;
  patientPhone?: string;
  patientAddress?: string;
  doctor?: string;
  date: string; // yyyy-mm-dd
  complaint?: string;     // presenting complaint / history
  investigation?: string; // tests advised or already done
  diagnosis?: string;
  items: PrescriptionItem[];
  note?: string;   // free-text note printed at the foot of the prescription
  photos?: string[]; // attached photos (reports, handwritten notes…) as data URLs
  advice?: string;
  followUpDate?: string; // yyyy-mm-dd, optional
  createdAt: string; // ISO timestamp
};

export type ClinicProfile = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  registrationNo: string; // clinic/hospital registration or license number
  address: string;
  currency: 'INR' | 'USD';
  billPrefix: string;
  nextBillSeq: number;
  upiVpa: string; // clinic UPI ID money is collected into (used for QR)
  upiName: string; // payee name shown in the patient's UPI app
};
