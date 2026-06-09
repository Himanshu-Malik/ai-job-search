'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Job } from '@/lib/types'
import MatchExplanation from './MatchExplanation'

interface Props {
  job: Job
  rank: number
  query: string
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Salary not disclosed'
  const fmt = (n: number) => `${(n / 100000).toFixed(0)} LPA`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `${fmt(min)}+`
  return `Up to ${fmt(max!)}`
}

function getMatchColor(similarity: number): { bg: string; text: string; border: string } {
  if (similarity >= 0.75) return { bg: '#ECFDF5', text: '#10B981', border: '#A7F3D0' }
  if (similarity >= 0.55) return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' }
  return { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' }
}

function getTypeColor(type: string): { bg: string; text: string } {
  if (type === 'remote') return { bg: '#ECFDF5', text: '#10B981' }
  if (type === 'hybrid') return { bg: '#FEF3C7', text: '#F59E0B' }
  return { bg: '#F3F4F6', text: '#6B7280' }
}

export default function JobCard({ job, rank, query }: Props) {
  const [expanded, setExpanded] = useState(false)
  const matchPct = job.similarity ? Math.round(job.similarity * 100) : null
  
  const matchColors = matchPct ? getMatchColor(job.similarity!) : null
  const typeColors = getTypeColor(job.type)

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 
        cursor-pointer card-hover-glow
        ${expanded 
          ? 'border-[#2563EB] border-l-4' 
          : 'border-gray-200 hover:border-[#2563EB]'
        }`}
      onClick={() => setExpanded(prev => !prev)}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Rank Number */}
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center 
            text-gray-500 text-sm font-semibold flex-shrink-0">
            {rank}
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
              <div 
                className="ml-auto transition-transform duration-300"
                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
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
                {job.skills?.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {skill}
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
        {expanded && (
          <div className="mt-6 pt-6 border-t border-gray-200 animate-fade-up" 
            style={{ animationDuration: '0.3s' }}>
            <MatchExplanation job={job} query={query} />
          </div>
        )}
      </div>
    </div>
  )
}