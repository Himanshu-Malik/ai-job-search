export default function JobCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 animate-fade-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="space-y-4">
        {/* Top row: rank + title + match */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Rank circle */}
            <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-3">
              {/* Title */}
              <div className="skeleton h-5 w-2/3" />
              {/* Company & location */}
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
          {/* Match badge */}
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>

        {/* Description lines */}
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
        </div>

        {/* Tags and salary */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="skeleton h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

// Export a list of skeletons for the loading state
export function JobCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}