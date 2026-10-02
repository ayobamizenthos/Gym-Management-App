'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ExerciseList } from '@/components/workouts/ExerciseList'

export default function ExerciseLibraryPage() {
  return (
    <div className="animate-rise">
      <Link href="/m/workouts" aria-label="Back to workouts" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
        <ChevronLeft size={26} aria-hidden />
      </Link>
      <h1 className="mb-5 mt-2 text-[40px]">Exercises</h1>
      <ExerciseList mode="browse" />
    </div>
  )
}
