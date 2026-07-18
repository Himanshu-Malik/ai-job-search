'use client'

import { useEffect, useState, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import type { Job } from '@/lib/types'

interface Props {
  job: Job
  query: string
}

type Status = 'loading' | 'streaming' | 'done' | 'error'

type ExplainPayload = {
  summary: string
  matchScore: number
  whyMatch: string[]
  missingAreas: string[]
  learningPlan: string[]
}

export default function MatchExplanation({ job, query }: Props) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('loading')
  const [insights, setInsights] = useState<ExplainPayload | null>(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const runId = runIdRef.current + 1
    runIdRef.current = runId

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const load = async () => {
      setStatus('loading')
      setText('')
      setInsights(null)

      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, job }),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error('Failed')

        const data = (await res.json()) as ExplainPayload
        const summary = data.summary?.trim() || 'We could not generate a detailed explanation for this role right now.'

        if (runId !== runIdRef.current) return

        setInsights(data)
        setStatus('streaming')

        for (let index = 1; index <= summary.length; index += 4) {
          if (runId !== runIdRef.current || controller.signal.aborted) return
          setText(summary.slice(0, index))
          await sleep(18)
        }

        if (runId !== runIdRef.current || controller.signal.aborted) return
        setText(summary)
        setStatus('done')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (runId !== runIdRef.current) return
        setStatus('error')
      }
    }

    void load()

    return () => {
      controller.abort()
    }
  }, [job, query])

  return (
    <div className="flex items-start gap-3">
      {/* AI Icon with gradient background */}
      <div className="w-6 h-6 rounded bg-gradient-to-br from-[#2563EB] to-[#8B5CF6] 
        flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
            AI Match Analysis
          </h4>
          {status === 'streaming' && (
            <span className="text-xs text-blue-500 animate-pulse">
              generating...
            </span>
          )}
          {status === 'done' && (
            <span className="text-xs text-emerald-600">✓ complete</span>
          )}
        </div>

        {/* Loading state */}
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce-dot" />
              <span 
                className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce-dot" 
                style={{ animationDelay: '0.1s' }}
              />
              <span 
                className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce-dot" 
                style={{ animationDelay: '0.2s' }}
              />
            </div>
            <span className="text-sm text-gray-400">Analyzing match...</span>
          </div>
        )}

        {/* Streaming / done text */}
        {(status === 'streaming' || status === 'done') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              {text}
              {status === 'streaming' && (
                <span className="inline-block w-0.5 h-4 bg-[#2563EB] ml-1 align-middle animate-pulse" />
              )}
            </p>
            {insights?.whyMatch?.length ? (
              <ul className="space-y-1.5">
                {insights.whyMatch.slice(0, 2).map((item) => (
                  <li key={item} className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <span>⚠️</span>
            <span>Could not generate explanation. Click card to retry.</span>
          </div>
        )}
      </div>
    </div>
  )
}
