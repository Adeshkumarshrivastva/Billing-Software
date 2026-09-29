import { NextResponse } from 'next/server';
import type { Model } from 'mongoose';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withErrorHandling(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    return jsonError(message, 500);
  }
}

/** Generates the next id like PAT-0006 from existing ids sharing a prefix, e.g. "PAT". */
export async function nextSequentialId(prefix: string, model: Model<{ id: string }>) {
  const [last] = await model.find({ id: new RegExp(`^${prefix}-`) }).sort({ id: -1 }).limit(1);
  const lastNumber = last ? Number(last.id.split('-').pop()) : 0;
  const next = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}
