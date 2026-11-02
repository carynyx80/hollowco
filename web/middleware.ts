import { NextResponse, type NextRequest } from 'next/server';
export function middleware(req: NextRequest) {
  const has = !!req.cookies.get('hc_session')?.value;
  const p = req.nextUrl.pathname;
  if (p.startsWith('/dashboard') && !has) { const u = req.nextUrl.clone(); u.pathname = '/signin'; u.search = `?next=${encodeURIComponent(p)}`; return NextResponse.redirect(u); }
  if ((p === '/signin' || p === '/signup') && has) { const u = req.nextUrl.clone(); u.pathname = '/dashboard'; u.search = ''; return NextResponse.redirect(u); }
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*', '/signin', '/signup'] };
