'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UploadCloud, FileText, Loader2, CircleCheck } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) {
      setError('Please choose a resume file first.')
      return
    }

    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const res = await fetch('/api/resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Upload failed')
      }

      setSuccess('Resume uploaded. Your profile is now ready.')
      setTimeout(() => {
        router.push('/feed')
        router.refresh()
      }, 900)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-[100svh] min-h-[100dvh] bg-[#F8FAFC] safe-area-px safe-area-pb">
      <section className="relative min-h-[100svh] min-h-[100dvh] overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center px-4 py-10 safe-area-pt safe-area-pb">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-16 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-30" />
          <div className="absolute bottom-20 right-16 w-80 h-80 bg-cyan-400 rounded-full blur-3xl opacity-20" />
        </div>

        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Upload your resume</h1>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            We use this to improve your job matching quality. Accepted formats: PDF, DOC, DOCX, TXT (max 5 MB).
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label
              htmlFor="resume"
              className="block rounded-2xl border-2 border-dashed border-white/25 p-6 text-center cursor-pointer hover:border-blue-300 transition-colors"
            >
              <UploadCloud className="mx-auto w-8 h-8 text-blue-200" />
              <p className="mt-3 text-white text-sm font-medium">
                {file ? 'Replace selected resume' : 'Click to choose your resume'}
              </p>
              <p className="text-xs text-slate-300 mt-1">Drag and drop is also supported by your browser.</p>
              <input
                id="resume"
                name="resume"
                type="file"
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            {file && (
              <div className="flex items-center gap-3 rounded-xl bg-white/15 border border-white/20 px-3 py-2 text-slate-100 text-sm">
                <FileText className="w-4 h-4" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto text-xs text-slate-300">{Math.round(file.size / 1024)} KB</span>
              </div>
            )}

            {error && <p className="text-sm text-red-300">{error}</p>}

            {success && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm">
                <CircleCheck className="w-4 h-4" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !file}
              className="w-full rounded-2xl bg-[#2563EB] hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-5 py-3.5 flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing resume...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="mt-4 w-full text-center text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign out and switch account
          </button>
        </div>
      </section>
    </main>
  )
}
