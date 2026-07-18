'use client'

import { signIn } from 'next-auth/react'

export default function GoogleLoginButton({
  callbackUrl = '/feed',
}: {
  callbackUrl?: string
}) {
  return (
    <button
      type="button"
      onClick={() => signIn('google', { callbackUrl })}
      className="w-full rounded-2xl border border-white/25 bg-white text-slate-900 font-semibold px-5 py-3.5 flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="h-5 w-5"
      >
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.7 2.8 30.3.5 24 .5 14.6.5 6.4 5.9 2.4 13.8l7.8 6.1C12.1 13.8 17.6 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.9 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h12.9c-.6 3-2.2 5.5-4.6 7.2l7.1 5.5c4.1-3.8 6.5-9.3 6.5-16.5z"/>
        <path fill="#FBBC05" d="M10.2 28.1c-1-3-1-6.3 0-9.3l-7.8-6.1C-.9 18.5-.9 29.5 2.4 35.3l7.8-7.2z"/>
        <path fill="#34A853" d="M24 47.5c6.3 0 11.6-2.1 15.4-5.7l-7.1-5.5c-2 1.4-4.6 2.2-8.3 2.2-6.4 0-11.9-4.3-13.8-10.2l-7.8 7.2C6.4 42.1 14.6 47.5 24 47.5z"/>
      </svg>
      Continue with Google
    </button>
  )
}
