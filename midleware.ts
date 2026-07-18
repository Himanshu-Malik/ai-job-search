import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const isProtected = pathname.startsWith('/feed')
    || pathname.startsWith('/onboarding')
    || pathname.startsWith('/profile')

  // Not signed in, trying to access protected route → home
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Signed in but hasn't onboarded → force onboarding
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