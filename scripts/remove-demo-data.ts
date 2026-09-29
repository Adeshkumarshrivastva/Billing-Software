// One-off cleanup: removes the 5 demo patients (PAT-0001..PAT-0005), the
// 5 demo bills (BILL-1044..BILL-1048) and the 3 demo prescriptions
// (RX-0001..RX-0003) that were inserted with fixed 2026 dates.
// Real records created through the app are left untouched.
//
// Usage: npx tsx scripts/remove-demo-data.ts

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/mongodb';
import { Patient } from '../lib/models/Patient';
import { Bill } from '../lib/models/Bill';
import { Prescription } from '../lib/models/Prescription';

const DEMO_PATIENTS = ['PAT-0001', 'PAT-0002', 'PAT-0003', 'PAT-0004', 'PAT-0005'];
const DEMO_BILLS = ['BILL-1044', 'BILL-1045', 'BILL-1046', 'BILL-1047', 'BILL-1048'];
const DEMO_PRESCRIPTIONS = ['RX-0001', 'RX-0002', 'RX-0003'];

async function main() {
  await connectToDatabase();

  // Guard: never drop a demo patient that a real (non-demo) bill still points at.
  const realBillsOnDemoPatients = await Bill.find({
    id: { $nin: DEMO_BILLS },
    patientId: { $in: DEMO_PATIENTS },
  }).lean();
  if (realBillsOnDemoPatients.length > 0) {
    console.error('Aborting — these real bills reference a demo patient:',
      realBillsOnDemoPatients.map((b) => `${b.id}→${b.patientId}`).join(', '));
    process.exit(1);
  }

  const bills = await Bill.deleteMany({ id: { $in: DEMO_BILLS } });
  const prescriptions = await Prescription.deleteMany({ id: { $in: DEMO_PRESCRIPTIONS } });
  const patients = await Patient.deleteMany({ id: { $in: DEMO_PATIENTS } });
  console.log(`Removed ${bills.deletedCount} demo bills, ${prescriptions.deletedCount} demo prescriptions, ${patients.deletedCount} demo patients.`);

  const remainingBills = await Bill.find({}).select('id date patientName -_id').sort({ date: 1 }).lean();
  const remainingPatients = await Patient.find({}).select('id name createdAt -_id').lean();
  console.log('\nRemaining bills:');
  remainingBills.forEach((b) => console.log(`  ${b.id} | ${b.date} | ${b.patientName}`));
  console.log('\nRemaining patients:');
  remainingPatients.forEach((p) => console.log(`  ${p.id} | ${p.name} | ${p.createdAt}`));

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
