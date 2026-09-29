// Populates the local MongoDB database with demo data so the app (and
// MongoDB Compass) have something to show. Safe to re-run — it wipes the
// seeded collections first, then reinserts a fresh copy of the seed set.
//
// Usage: npm run seed   (requires a local `mongod` reachable at MONGODB_URI)

import 'dotenv/config';
import { connectToDatabase } from '../lib/mongodb';
import { Patient } from '../lib/models/Patient';
import { ServiceItem } from '../lib/models/ServiceItem';
import { Bill } from '../lib/models/Bill';
import { Prescription } from '../lib/models/Prescription';
import { Profile, PROFILE_KEY } from '../lib/models/Profile';
import { seedBills, seedPatients, seedPrescriptions, seedProfile, seedServices } from '../lib/seed-data';
import mongoose from 'mongoose';

async function main() {
  console.log('Connecting to MongoDB...');
  await connectToDatabase();

  console.log('Clearing existing collections (patients, services, bills, prescriptions, profile)...');
  await Promise.all([Patient.deleteMany({}), ServiceItem.deleteMany({}), Bill.deleteMany({}), Prescription.deleteMany({}), Profile.deleteMany({})]);

  console.log(`Inserting ${seedPatients.length} patients...`);
  await Patient.insertMany(seedPatients);

  console.log(`Inserting ${seedServices.length} services...`);
  await ServiceItem.insertMany(seedServices);

  console.log(`Inserting ${seedBills.length} bills...`);
  await Bill.insertMany(seedBills);

  console.log(`Inserting ${seedPrescriptions.length} prescriptions...`);
  await Prescription.insertMany(seedPrescriptions);

  console.log('Inserting clinic profile...');
  await Profile.create({ key: PROFILE_KEY, ...seedProfile });

  console.log('Done. Open MongoDB Compass and connect to mongodb://127.0.0.1:27017 to browse the "pmc_billing" database.');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
