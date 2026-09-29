import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/lib/auth';

// Anyone who isn't signed in can only reach /login, /register and the auth
// APIs — everything else (pages and data APIs alike) needs a valid session,
// so an unauthorised person can never create or edit a bill.
const PUBLIC_PAGES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  // Already signed in (the session cookie lasts 30 days)? Skip the login /
  // register screens entirely and drop straight into the workspace — no need
  // to sign in again on every visit.
  if (PUBLIC_PAGES.includes(pathname)) {
    return session ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // The Bills section is the full bill record — admin only. A regular user
  // gets every other page (Overview, Day log, Patients, Services, Reports,
  // Settings), just not this one.
  const adminOnly = pathname.startsWith('/admin') || pathname === '/bills' || pathname.startsWith('/bills/');
  if (adminOnly && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|pmc-logo.png).*)'],
};
