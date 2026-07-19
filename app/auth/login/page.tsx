import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import GoogleLoginButton from '@/components/GoogleLoginButton'

export default async function LoginPage() {
  const session = await auth()

  if (session?.user?.onboardingComplete) {
    redirect('/feed')
  }

  if (session && !session.user.onboardingComplete) {
    redirect('/onboarding')
  }

  return (
    <main className="min-h-[100svh] min-h-[100dvh] bg-[#F8FAFC] safe-area-px safe-area-pb">
      <section className="relative min-h-[100svh] min-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center px-4 py-10 safe-area-pt safe-area-pb">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-16 left-10 sm:left-20 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500 rounded-full blur-3xl opacity-30" />
          <div className="absolute bottom-16 right-10 sm:right-20 w-72 sm:w-96 h-72 sm:h-96 bg-cyan-400 rounded-full blur-3xl opacity-20" />
        </div>

        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/85">
            AI-Powered Job Search
          </div>

          <h1 className="mt-5 text-3xl sm:text-4xl font-bold text-white leading-tight">
            Welcome back
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            Sign in to personalize your job matches, save searches, and unlock resume-based recommendations.
          </p>

          <div className="mt-8 space-y-4">
            <GoogleLoginButton callbackUrl="/feed" />
            <p className="text-xs text-slate-300 text-center">
              By continuing, you agree to sign in with your Google account.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
