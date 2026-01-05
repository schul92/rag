'use client'

import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { cn } from '@/lib/utils'
import React from 'react'

interface KeenCarouselProps {
  children: React.ReactNode
  className?: string
  slidesPerView?: number
  mobileSlidesPerView?: number
  spacing?: number
}

export function KeenCarousel({
  children,
  className,
  slidesPerView = 3,
  mobileSlidesPerView = 2.3,
  spacing = 12,
}: KeenCarouselProps) {
  const [sliderRef] = useKeenSlider<HTMLDivElement>({
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
  })

  return (
    <div ref={sliderRef} className={cn('keen-slider', className)}>
      {children}
    </div>
  )
}

interface KeenSlideProps {
  children: React.ReactNode
  className?: string
}

export function KeenSlide({ children, className }: KeenSlideProps) {
  return (
    <div
      className={cn('keen-slider__slide', className)}
      data-keen-slider-clickable
    >
      {children}
    </div>
  )
}
