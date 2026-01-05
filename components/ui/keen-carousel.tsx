'use client'

import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { cn } from '@/lib/utils'
import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface KeenCarouselProps {
  children: React.ReactNode
  className?: string
  slidesPerView?: number
  mobileSlidesPerView?: number
  spacing?: number
  showArrows?: boolean
}

export function KeenCarousel({
  children,
  className,
  slidesPerView = 3,
  mobileSlidesPerView = 2.3,
  spacing = 12,
  showArrows = true,
}: KeenCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    slides: {
      perView: mobileSlidesPerView,
      spacing: spacing,
    },
    breakpoints: {
      '(min-width: 640px)': {
        slides: { perView: slidesPerView, spacing: spacing },
      },
    },
    rubberband: true,
    mode: 'free-snap',
    slideChanged(slider) {
      setCurrentSlide(slider.track.details.rel)
    },
    created() {
      setLoaded(true)
    },
  })

  return (
    <div className="relative">
      <div ref={sliderRef} className={cn('keen-slider', className)}>
        {children}
      </div>

      {/* Navigation arrows - desktop only */}
      {showArrows && loaded && instanceRef.current && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-border hover:bg-background"
            onClick={() => instanceRef.current?.prev()}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border-border hover:bg-background"
            onClick={() => instanceRef.current?.next()}
            disabled={
              currentSlide >=
              (instanceRef.current.track.details?.slides?.length || 0) - Math.floor(slidesPerView)
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}

interface KeenSlideProps {
  children: React.ReactNode
  className?: string
}

export function KeenSlide({ children, className }: KeenSlideProps) {
  return (
    <div className={cn('keen-slider__slide', className)}>
      {children}
    </div>
  )
}
