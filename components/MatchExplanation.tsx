'use client'

import { useEffect, useState, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import type { Job } from '@/lib/types'

interface Props {
  job: Job
  query: string
}

type Status = 'loading' | 'streaming' | 'done' | 'error'

export default function MatchExplanation({ job, query }: Props) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('loading')
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchExplanation()
  }, [job.id, query])

  async function fetchExplanation() {
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, job }),
      })

      if (!res.ok) throw new Error('Failed')
      if (!res.body) throw new Error('No stream')

      setStatus('streaming')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setText(prev => prev + chunk)
      }

      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

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
          <p className="text-sm text-gray-600 leading-relaxed">
            {text}
            {/* Blinking cursor */}
            {status === 'streaming' && (
              <span className="inline-block w-0.5 h-4 bg-[#2563EB] ml-0.5 
                align-middle animate-blink rounded-sm" />
            )}
          </p>
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
