'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, Sparkles, AlertCircle, SearchX, ChevronDown, Loader2 } from 'lucide-react'
import type { Job } from '@/lib/types'

type ViewState = 'home' | 'loading' | 'results' | 'empty' | 'error'

const suggestionChips = [
  'Remote React job at a startup',
  'Senior engineer in Bangalore, 20+ LPA',
  'Frontend with TypeScript, not a service company',
  'Fintech, hybrid, equity options',
  'DevTools company, fully remote',
]

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>('home')
  const [searchQuery, setSearchQuery] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [cached, setCached] = useState(false)

  const isCompressed = viewState !== 'home'

  async function handleSearch(query: string) {
    if (!query.trim()) return

    setSearchQuery(query)
    setViewState('loading')
    setCached(false)

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()

      if (!data.jobs?.length) {
        setViewState('empty')
        setJobs([])
      } else {
        setJobs(data.jobs)
        setCached(data.cached)
        setViewState('results')
      }
    } catch {
      setViewState('error')
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setSearchQuery(suggestion)
    handleSearch(suggestion)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] h-[100vh] flex items-center justify-center"
        style={{ height: isCompressed ? 'auto' : '100vh', padding: isCompressed ? '3rem 1rem' : '' }}
      >
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-20" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-30" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-20" />
        </div>

        {/* Dot Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-10" 
          style={{
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }} 
        />

        <div className="relative max-w-3xl mx-auto px-4">
          <AnimatePresence>
            {viewState === 'home' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="text-center mb-10 space-y-6"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-[5px] px-[10px] rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                  style={{borderColor: 'white'}}
                >
                  <motion.div
                    className="w-2 h-2 bg-[#2563EB] rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-white text-sm font-medium" style={{ color: 'white' }}>AI-Powered Job Search</span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-4xl md:text-5xl font-bold text-white leading-tight"
                  style={{ color: 'white' }}
                >
                  Find your{' '}
                  <span className="bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] bg-clip-text text-transparent">
                    next role
                  </span>
                  {' '}with AI
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto"
                  style={{ color: '#d1d5db' }}
                >
                  Describe your ideal job in plain English. AI finds the best matches instantly.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: viewState === 'home' ? 0.4 : 0 }}
            className="relative "
          >
            <div className="relative bg-white rounded-full shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  placeholder="Describe your ideal job in plain English..."
                  className="flex-1 outline-none text-gray-900 placeholder:text-gray-400 bg-transparent"
                  style={{ color: '#111827' }}
                  disabled={viewState === 'loading'}
                />

                <AnimatePresence>
                  {searchQuery && viewState !== 'loading' && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setSearchQuery('')}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </motion.button>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSearch(searchQuery)}
                  disabled={!searchQuery.trim() || viewState === 'loading'}
                  className="bg-[#0F172A] hover:bg-[#2563EB] disabled:opacity-50 disabled:hover:bg-[#0F172A] text-white px-6 py-2.5 rounded-full font-medium flex items-center gap-2 transition-colors duration-200"
                >
                  {viewState === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Searching...</span>
                    </>
                  ) : (
                    <>
                      <span>Search</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Suggestion Chips */}
          <AnimatePresence>
            {viewState === 'home' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex flex-wrap gap-2 justify-center mt-6"
              >
                {suggestionChips.map((chip, index) => (
                  <motion.button
                    key={chip}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    whileHover={{ scale: 1.05, backgroundColor: '#2563EB', color: '#ffffff' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSuggestionClick(chip)}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-[#2563EB] text-white/80 hover:text-white text-sm font-medium backdrop-blur-sm border border-white/20 transition-colors duration-200"
                  >
                    {chip}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <AnimatePresence mode="wait">
          {/* Loading State */}
          {viewState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 mt-8"
            >
              {/* Loading Message */}
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-[#2563EB] rounded-full"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-gray-600">Finding best matches for "{searchQuery}"...</span>
              </div>

              {/* Skeleton Cards */}
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} index={i} />
              ))}
            </motion.div>
          )}

          {/* Results State */}
          {viewState === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 mt-8"
            >
              {/* Results Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <h2 className="text-xl font-semibold text-gray-900">
                  Found {jobs.length} matches for "{searchQuery}"
                </h2>
                {cached && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#2563EB] text-white text-xs font-semibold rounded-full"
                  >
                    ⚡ Instant
                  </motion.span>
                )}
              </motion.div>

              {/* Job Cards */}
              {jobs.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  query={searchQuery}
                  isExpanded={expandedCard === job.id}
                  onToggle={() => setExpandedCard(expandedCard === job.id ? null : job.id)}
                />
              ))}
            </motion.div>
          )}

          {/* Empty State */}
          {viewState === 'empty' && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-center py-20"
            >
              <div className="text-center max-w-md">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <SearchX className="w-10 h-10 text-gray-400" />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-semibold text-gray-900 mb-2"
                >
                  No matches found
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-600"
                >
                  Try adjusting your search with different keywords
                </motion.p>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {viewState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-center py-20"
            >
              <div className="text-center max-w-md">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring' }}
                  className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-semibold text-gray-900 mb-2"
                >
                  Something went wrong
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-600"
                >
                  Please check your connection and try again
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SKELETON CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
    >
      <div className="relative overflow-hidden">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// JOB CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
function JobCard({ 
  job, 
  index, 
  query,
  isExpanded, 
  onToggle 
}: { 
  job: Job
  index: number
  query: string
  isExpanded: boolean
  onToggle: () => void 
}) {
  const matchPct = job.similarity ? Math.round(job.similarity * 100) : null

  const getMatchColor = (match: number) => {
    if (match >= 75) return { bg: '#ECFDF5', text: '#10B981', border: '#A7F3D0' }
    if (match >= 55) return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }
    return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' }
  }

  const getTypeColor = (type: string) => {
    if (type === 'remote') return { bg: '#ECFDF5', text: '#10B981' }
    if (type === 'hybrid') return { bg: '#FEF3C7', text: '#F59E0B' }
    return { bg: '#F3F4F6', text: '#6B7280' }
  }

  const matchColors = matchPct ? getMatchColor(matchPct) : null
  const typeColors = getTypeColor(job.type)

  function formatSalary(min?: number, max?: number): string {
    if (!min && !max) return 'Salary not disclosed'
    const fmt = (n: number) => `${(n / 100000).toFixed(0)} LPA`
    if (min && max) return `${fmt(min)} – ${fmt(max)}`
    if (min) return `${fmt(min)}+`
    return `Up to ${fmt(max!)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -2, boxShadow: '0 10px 25px rgba(37, 99, 235, 0.15)' }}
      className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 cursor-pointer ${
        isExpanded ? 'border-[#2563EB] border-l-4' : 'border-gray-200 hover:border-[#2563EB]'
      }`}
      onClick={onToggle}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Rank Number */}
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-sm font-semibold flex-shrink-0">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title and Match */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <h3 className="text-base font-semibold text-gray-900">{job.title}</h3>
              {matchPct && matchColors && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: matchColors.bg,
                    color: matchColors.text,
                    border: `1px solid ${matchColors.border}`
                  }}
                >
                  {matchPct}% match
                </span>
              )}
            </div>

            {/* Company and Location */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <span className="font-medium">{job.company}</span>
              <span>•</span>
              <span>{job.location}</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="ml-auto"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </motion.div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{job.description}</p>

            {/* Tags and Salary */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                  style={{ backgroundColor: typeColors.bg, color: typeColors.text }}
                >
                  {job.type}
                </span>
                {job.skills?.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
                {(job.skills?.length ?? 0) > 3 && (
                  <span className="text-xs text-gray-500 font-medium">
                    +{job.skills!.length - 3} more
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {formatSalary(job.salary_min, job.salary_max)}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded AI Analysis */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-gray-200">
                <AIMatchAnalysis job={job} query={query} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AI MATCH ANALYSIS COMPONENT
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react'

function AIMatchAnalysis({ job, query }: { job: Job; query: string }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'loading' | 'streaming' | 'done' | 'error'>('loading')
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

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

    fetchExplanation()
  }, [job.id, query])

  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded bg-gradient-to-br from-[#2563EB] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
            AI Match Analysis
          </h4>
          {status === 'streaming' && (
            <span className="text-xs text-blue-500 animate-pulse">generating...</span>
          )}
          {status === 'done' && (
            <span className="text-xs text-emerald-600">✓ complete</span>
          )}
        </div>
        
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-[#2563EB] rounded-full"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            <span className="text-sm text-gray-400">Analyzing match...</span>
          </div>
        )}

        {(status === 'streaming' || status === 'done') && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-600 leading-relaxed"
          >
            {text}
            {status === 'streaming' && (
              <span className="inline-block w-0.5 h-4 bg-[#2563EB] ml-0.5 align-middle animate-pulse" />
            )}
          </motion.p>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-500">
            Could not generate analysis. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}