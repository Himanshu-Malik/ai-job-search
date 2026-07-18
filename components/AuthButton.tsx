'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

export default function AuthButton() {
  const { data: session, status } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  if (status === 'loading') {
    return <div className="w-24 h-9 rounded-full bg-white/10 animate-pulse" />
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google', { callbackUrl: '/feed' })}
        className="flex items-center gap-2 px-4 py-2 rounded-full
          bg-white text-slate-800 text-sm font-semibold
          hover:bg-slate-100 transition-colors active:scale-95"
      >
        <span className="text-base leading-none">G</span>
        Sign in
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full
          border border-white/20 hover:bg-white/10 transition-colors"
      >
        {session.user.image && (
          <img
            src={session.user.image}
            alt=""
            className="w-7 h-7 rounded-full"
          />
        )}
        <span className="text-sm text-white/80 pr-1">
          {session.user.name?.split(' ')[0]}
        </span>
        <span className="text-white/50 text-xs">▾</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-11 w-44 bg-white rounded-xl
          shadow-lg border border-slate-200 py-1 z-50">
          <a
            href="/feed"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Home
          </a>
          <a
            href="/onboarding"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Update Resume
          </a>
          <button
            onClick={() => signOut()}
            className="w-full text-left px-4 py-2 text-sm
              text-red-600 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}