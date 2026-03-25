import { NextResponse } from 'next/server';

// TODO(AUTH): Integrate accurate NextAuth logic and uncomment authConfig.
// Currently bypassed to allow direct UI inspection.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};

