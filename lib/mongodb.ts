import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pmc_billing';

// Next.js hot-reloads route modules in dev, which would otherwise open a new
// connection on every request. Cache the promise on `global` so the whole
// process reuses one connection.
type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global {
  // eslint-disable-next-line no-var
  var __pmcMongoose: MongooseCache | undefined;
}

const cache: MongooseCache = global.__pmcMongoose ?? { conn: null, promise: null };
global.__pmcMongoose = cache;

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
