'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, MapPin, Wallet, BriefcaseBusiness, Sparkles, X } from 'lucide-react'
import type { Job } from '@/lib/types'

type ExplainPayload = {
  summary: string
  matchScore: number
  whyMatch: string[]
  missingAreas: string[]
  learningPlan: string[]
  jobHighlights: string[]
  cached?: boolean
}

type Props = {
  job: Job | null
  query: string
  onClose: () => void
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Salary not disclosed'
  const fmt = (n: number) => `${(n / 100000).toFixed(0)} LPA`
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max as number)}`
}

function normalizeMatchScore(job: Job, analysisScore?: number): number {
  if (typeof analysisScore === 'number') return analysisScore
  if (typeof job.similarity === 'number') return Math.max(0, Math.min(100, Math.round(job.similarity * 100)))
  return 60
}

export default function JobDetailsModal({ job, query, onClose }: Props) {
  const [analysis, setAnalysis] = useState<ExplainPayload | null>(null)
  const [displaySummary, setDisplaySummary] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming' | 'done' | 'error'>('idle')

  const matchScore = useMemo(() => {
    if (!job) return 0
    return normalizeMatchScore(job, analysis?.matchScore)
  }, [analysis?.matchScore, job])

  useEffect(() => {
    if (!job) return

    const controller = new AbortController()
    let isActive = true

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const load = async () => {
      setStatus('loading')
      setAnalysis(null)
      setDisplaySummary('')

      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, job }),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error('Failed to fetch explanation')
        const data = (await res.json()) as ExplainPayload

        if (!isActive || controller.signal.aborted) return

        setAnalysis(data)
        setStatus('streaming')

        const summary = data.summary?.trim() || 'We could not generate a detailed explanation for this role right now.'
        for (let index = 1; index <= summary.length; index += 5) {
          if (!isActive || controller.signal.aborted) return
          setDisplaySummary(summary.slice(0, index))
          await sleep(18)
        }

        if (!isActive || controller.signal.aborted) return
        setDisplaySummary(summary)
        setStatus('done')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!isActive) return
        setStatus('error')
      }
    }

    void load()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [job, query])

  useEffect(() => {
    if (!job) return

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onEsc)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onEsc)
    }
  }, [job, onClose])

  if (!job) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6 safe-area-pt safe-area-pb safe-area-px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="mx-auto mt-3 sm:mt-8 w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 shadow-2xl"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 backdrop-blur px-4 sm:px-6 py-4">
            <div className="flex items-start gap-3 justify-between">
              <div>
                <p className="text-[11px] tracking-[0.18em] uppercase text-blue-300/90">Role Breakdown</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">{job.title}</h2>
                <p className="text-sm text-slate-300 mt-1">{job.company}</p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-xl border border-white/15 text-slate-200 hover:text-white hover:bg-white/10 p-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-100 text-xs">
                <MapPin className="w-3.5 h-3.5 text-blue-300" /> {job.location}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-100 text-xs capitalize">
                <BriefcaseBusiness className="w-3.5 h-3.5 text-cyan-300" /> {job.type}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-100 text-xs">
                <Wallet className="w-3.5 h-3.5 text-emerald-300" /> {formatSalary(job.salary_min, job.salary_max)}
              </span>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-5 sm:py-6 grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-5">
            <section className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-blue-200 uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Job Explanation
                </h3>

                {status === 'loading' && (
                  <p className="text-sm text-slate-300 mt-3">Analyzing job description and profile fit...</p>
                )}

                {status === 'error' && (
                  <p className="text-sm text-red-300 mt-3">Could not generate explanation right now. Please try another job.</p>
                )}

                {(status === 'streaming' || status === 'done') && (
                  <p className="text-sm text-slate-200 mt-3 leading-7">
                    {displaySummary || analysis?.summary || 'Generating explanation...'}
                    {status === 'streaming' && (
                      <span className="inline-block w-0.5 h-4 bg-blue-300 ml-1 align-middle animate-pulse" />
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-100">Job Details</h3>
                <p className="text-sm text-slate-300 mt-2 leading-7 whitespace-pre-wrap">{job.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span key={skill} className="px-3 py-1 rounded-full text-xs bg-blue-500/15 text-blue-100 border border-blue-300/25">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-blue-300/25 bg-gradient-to-br from-blue-500/15 to-cyan-500/10 p-4 sm:p-5">
                <p className="text-xs uppercase tracking-wide text-blue-200">Resume Match</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-bold text-white">{matchScore}%</p>
                  <p className="text-xs text-slate-300 pb-1">estimated fit</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-300" style={{ width: `${matchScore}%` }} />
                </div>
              </div>

              <ListCard
                title={`Why ${matchScore}% Match`}
                items={analysis?.whyMatch ?? []}
                emptyText="Match reasons are being generated."
                tone="blue"
              />

              <ListCard
                title="What Is Not Matching Yet"
                items={analysis?.missingAreas ?? []}
                emptyText="No major gaps detected yet."
                tone="amber"
              />

              <ListCard
                title="What To Learn Next"
                items={analysis?.learningPlan ?? []}
                emptyText="Learning suggestions are being prepared."
                tone="emerald"
              />
            </aside>
          </div>

          <div className="border-t border-white/10 px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-slate-100 hover:bg-white/10 transition-colors"
            >
              Close
            </button>

            {job.apply_url ? (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-500 text-white font-semibold transition-colors"
              >
                Apply Now
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-700/60 text-slate-300 text-sm">
                Apply URL unavailable
              </span>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function ListCard({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string
  items: string[]
  emptyText: string
  tone: 'blue' | 'amber' | 'emerald'
}) {
  const toneClasses = {
    blue: 'border-blue-300/20 bg-blue-500/10 text-blue-100',
    amber: 'border-amber-300/20 bg-amber-500/10 text-amber-100',
    emerald: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100',
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 mt-2">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className={`text-xs rounded-xl px-3 py-2 border ${toneClasses[tone]}`}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
