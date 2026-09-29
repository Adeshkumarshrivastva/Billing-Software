export const ADMIN_PHONE_NUMBERS = ['6287911867', '9440993344'];

export function normalizePhone(value: string): string {
  return String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}
export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return /^\d{10}$/.test(normalized);
}
export function isAdminPhone(value: string): boolean {
  const normalized = normalizePhone(value);
  return ADMIN_PHONE_NUMBERS.includes(normalized);
}

type OtpEntry = {
  otp: string;
  expiresAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __pmc_otp_store: Map<string, OtpEntry> | undefined;
}

const otpStore = globalThis.__pmc_otp_store ?? new Map<string, OtpEntry>();
globalThis.__pmc_otp_store = otpStore;

export function createOtpForPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalized, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  return otp;
}
export async function sendOtpSMS(phone: string, otp: string): Promise<boolean> {
  const params = new URLSearchParams({
    uname: process.env.SMS_UNAME ?? '',
    pass: process.env.SMS_PASS ?? '',
    send: process.env.SMS_SENDER_ID ?? '',
    dest: phone,
    msg: `Dear customer, your OTP for registration is ${otp} Use this OTP to validate your login.\nPSTVMC`,
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // prpsms.biz migrated off the old portal — same uname / pass / sender ID,
    // new endpoint. The old one was http://164.52.195.161/API/SendMsg.aspx.
    const response = await fetch(
      `${process.env.SMS_API_BASE_URL}/BulkSMSapi/keyApiSendSMS/SendMsg?${params.toString()}`,
      { signal: controller.signal },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function verifyOtpForPhone(phone: string, otp: string): boolean {
  const normalized = normalizePhone(phone);
  const entry = otpStore.get(normalized);
  if (!entry) return false;

  const hasExpired = Date.now() > entry.expiresAt;
  if (hasExpired) {
    otpStore.delete(normalized);
    return false;
  }

  const ok = entry.otp === String(otp).trim();
  if (ok) otpStore.delete(normalized);
  return ok;
}
