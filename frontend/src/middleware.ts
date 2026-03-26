import { NextResponse } from 'next/server';

// Temporarily disabled - causing auth callback issues
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$).*)'],
};

