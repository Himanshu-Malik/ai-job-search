'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, AlertCircle, SearchX, Loader2 } from 'lucide-react'
import type { Job } from '@/lib/types'
import AuthButton from '@/components/AuthButton'
import JobDetailsModal from '@/components/JobDetailsModal'

type ViewState = 'home' | 'loading' | 'results' | 'empty' | 'error'
type ResultSource = 'resume' | 'search'
type PersistedFeedState = {
  source: ResultSource
  query: string
  expandedCard: string | null
  scrollY: number
}

const FEED_STATE_KEY = 'feed-state-v1'

function readPersistedFeedState(): Partial<PersistedFeedState> | null {
  if (typeof window === 'undefined') return null

  const stored = sessionStorage.getItem(FEED_STATE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as Partial<PersistedFeedState>
  } catch {
    return null
  }
}

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
  const [expandedCard, setExpandedCard] = useState<string | null>(
    () => readPersistedFeedState()?.expandedCard ?? null
  )
  const [cached, setCached] = useState(false)
  const [source, setSource] = useState<ResultSource>('resume')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const hasHydrated = useRef(false)
  const pendingScrollRestore = useRef<number | null>(null)

  const isCompressed = viewState !== 'home'

  useEffect(() => {
    if (hasHydrated.current) return
    hasHydrated.current = true

    const parsed = readPersistedFeedState()

    if (!parsed) {
      loadRecommendations(false)
      return
    }

    pendingScrollRestore.current = typeof parsed.scrollY === 'number' ? parsed.scrollY : null

    if (parsed.source === 'search' && parsed.query?.trim()) {
      handleSearch(parsed.query, false)
      return
    }

    loadRecommendations(false)
  }, [])

  function saveFeedState(
    nextSource: ResultSource,
    query: string,
    nextExpandedCard: string | null = expandedCard,
    scrollY = window.scrollY
  ) {
    sessionStorage.setItem(
      FEED_STATE_KEY,
      JSON.stringify({
        source: nextSource,
        query,
        expandedCard: nextExpandedCard,
        scrollY,
      } satisfies PersistedFeedState)
    )
  }

  useEffect(() => {
    if (!hasHydrated.current) return

    const persist = () => {
      saveFeedState(source, searchQuery)
    }

    window.addEventListener('beforeunload', persist)
    window.addEventListener('pagehide', persist)

    return () => {
      persist()
      window.removeEventListener('beforeunload', persist)
      window.removeEventListener('pagehide', persist)
    }
  }, [source, searchQuery, expandedCard])

  useEffect(() => {
    if (viewState === 'loading') return
    if (pendingScrollRestore.current === null) return

    window.scrollTo({ top: pendingScrollRestore.current })
    pendingScrollRestore.current = null
  }, [viewState, jobs.length])

  async function loadRecommendations(shouldPersist = true) {
    setViewState('loading')
    setCached(false)
    setSource('resume')
    setSearchQuery('')
    setExpandedCard(null)

    if (shouldPersist) {
      saveFeedState('resume', '', null, 0)
    }

    try {
      const res = await fetch('/api/recommendations')
      if (!res.ok) throw new Error('Failed')

      const data = await res.json()

      if (!data.jobs?.length) {
        setJobs([])
        setViewState('empty')
      } else {
        setJobs(data.jobs)
        setViewState('results')
      }
    } catch {
      setJobs([])
      setViewState('home')
    }
  }

  async function handleSearch(query: string, shouldPersist = true) {
    if (!query.trim()) return

    setSearchQuery(query)
    setViewState('loading')
    setCached(false)
    setSource('search')
    setExpandedCard(null)

    if (shouldPersist) {
      saveFeedState('search', query, null, 0)
    }

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

  function handleClearSearch() {
    setSearchQuery('')

    if (source === 'search') {
      loadRecommendations()
    }
  }

  function handleSearchButtonClick() {
    if (searchQuery.trim()) {
      handleSearch(searchQuery)
      return
    }

    if (source === 'search') {
      loadRecommendations()
    }
  }

  const explanationQuery = source === 'search'
    ? searchQuery.trim() || 'search intent'
    : 'resume profile match'

  return (
    <div className="min-h-[100svh] min-h-[100dvh] bg-[#F8FAFC]">
      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] flex items-center justify-center ${
          isCompressed ? 'py-12 px-4' : 'min-h-[100svh] min-h-[100dvh]'
        }`}
      >
        <div className="absolute inset-x-0 top-0 z-30 safe-area-pt safe-area-px px-3 sm:px-6 py-3 sm:py-5">
          <div className="flex justify-end">
            <div className="origin-top-right scale-[0.92] sm:scale-100">
              <AuthButton />
            </div>
          </div>
        </div>

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

        <div className="relative w-full max-w-3xl mx-auto px-4 pt-14 sm:pt-16 pb-8 sm:pb-10">
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
                  className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight"
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
                  className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto"
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
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchButtonClick()
                    }
                  }}
                  placeholder="Describe your ideal job in plain English..."
                  className="flex-1 min-w-0 outline-none text-sm sm:text-base text-gray-900 placeholder:text-gray-400 bg-transparent"
                  style={{ color: '#111827' }}
                  disabled={viewState === 'loading'}
                />

                <AnimatePresence>
                  {searchQuery && viewState !== 'loading' && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleClearSearch}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </motion.button>
                  )}
                </AnimatePresence>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearchButtonClick}
                  disabled={viewState === 'loading' || (!searchQuery.trim() && source !== 'search')}
                  className="bg-[#0F172A] hover:bg-[#2563EB] disabled:opacity-50 disabled:hover:bg-[#0F172A] text-white px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-medium flex items-center gap-1.5 sm:gap-2 transition-colors duration-200"
                >
                  {viewState === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden sm:inline">Searching...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Search</span>
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
      <div className="max-w-3xl mx-auto px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
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
                <span className="text-gray-600">Finding best matches for {searchQuery}...</span>
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
                  {source === 'resume'
                    ? `Recommended ${jobs.length} jobs from your resume`
                    : `Found ${jobs.length} matches for ${searchQuery}`}
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
                {source === 'resume' && (
                  <button
                    type="button"
                    onClick={() => loadRecommendations()}
                    className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Refresh
                  </button>
                )}
                {source === 'search' && (
                  <button
                    type="button"
                    onClick={() => loadRecommendations()}
                    className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Reset to recommendations
                  </button>
                )}
              </motion.div>

              {/* Job Cards */}
              {jobs.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={index}
                  onOpen={() => {
                    setSelectedJob(job)
                    saveFeedState(source, searchQuery, expandedCard)
                  }}
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

      <JobDetailsModal
        job={selectedJob}
        query={explanationQuery}
        onClose={() => setSelectedJob(null)}
      />
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
  onOpen,
}: { 
  job: Job
  index: number
  onOpen: () => void
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
      className="bg-white rounded-2xl shadow-sm border border-gray-200 transition-all duration-300 cursor-pointer hover:border-[#2563EB]"
      onClick={onOpen}
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
              <span className="ml-auto text-xs text-blue-600 font-medium">View details</span>
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
      </div>
    </motion.div>
  )
}
