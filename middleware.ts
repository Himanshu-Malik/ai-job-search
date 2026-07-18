import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const isProtected =
    pathname.startsWith('/feed') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/profile')

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (
    session &&
    !session.user.onboardingComplete &&
    (pathname.startsWith('/feed') || pathname.startsWith('/profile'))
  ) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/feed/:path*', '/onboarding/:path*', '/profile/:path*'],
}
