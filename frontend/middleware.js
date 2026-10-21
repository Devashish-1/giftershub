import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();
  const pathname = request.nextUrl.pathname;

  if (!hostname.startsWith('admin.')) return NextResponse.next();
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    return NextResponse.rewrite(url);
  }
  if (pathname.startsWith('/admin')) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
