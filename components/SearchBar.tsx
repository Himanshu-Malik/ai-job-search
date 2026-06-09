'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, ArrowRight, Loader2 } from 'lucide-react'

interface Props {
  onSearch: (query: string) => void
  isLoading: boolean
  showSuggestions?: boolean
}

const SUGGESTIONS = [
  'Remote React job at a startup',
  'Senior engineer in Bangalore, 20+ LPA',
  'Frontend with TypeScript, not a service company',
  'Fintech, hybrid, equity options',
  'DevTools company, fully remote',
]

export default function SearchBar({ onSearch, isLoading, showSuggestions = true }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSearch() {
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    onSearch(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  function handleSuggestion(text: string) {
    setQuery(text)
    onSearch(text)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search container — white pill with shadow */}
      <div className="relative bg-white rounded-full shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4">
          {/* Search icon */}
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your ideal job in plain English..."
            className="flex-1 outline-none text-gray-900 placeholder:text-gray-400 
              bg-transparent text-base min-w-0"
            disabled={isLoading}
          />

          {/* Clear button */}
          {query && !isLoading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="bg-[#0F172A] hover:bg-[#2563EB] text-white px-6 py-2.5 
              rounded-full font-medium flex items-center gap-2 transition-colors 
              duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              disabled:hover:bg-[#0F172A] flex-shrink-0"
          >
            {isLoading ? (
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
          </button>
        </div>
      </div>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={isLoading}
              className="animate-fade-up text-xs sm:text-sm px-4 py-2 rounded-full
                bg-white/10 backdrop-blur-sm text-white/80 border border-white/20
                hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB]
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ animationDelay: `${500 + i * 50}ms` }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}