import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/lib/models/User';
import { createOtpForPhone, isAdminPhone, normalizePhone, isValidPhone, sendOtpSMS } from '@/lib/otp';
import { jsonError, withErrorHandling } from '@/lib/api-utils';

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const body = await request.json();
    const phone = normalizePhone(String(body.phone ?? ''));

    if (!isValidPhone(phone)) {
      return jsonError('Enter a valid 10-digit phone number.', 400);
    }

    await connectToDatabase();
    const user = await User.findOne({ phone }).lean();
    const isAdmin = isAdminPhone(phone);

    if (!user && !isAdmin) {
      return jsonError('No account found for this phone number. Please register first.', 404);
    }

    const otp = createOtpForPhone(phone);
    const otpSent = await sendOtpSMS(phone, otp);
    if (!otpSent) {
      return jsonError('Could not send OTP. Please try again later.', 502);
    }

    return NextResponse.json({
      ok: true,
      message: 'OTP sent successfully.',
      phone,
      role: isAdmin ? 'admin' : 'user',
    });
  });
}
