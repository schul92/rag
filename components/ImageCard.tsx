'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Music, X, Globe, Download, Share2, Check, ChevronLeft, ChevronRight, FileStack } from 'lucide-react'

interface RelatedPage {
  id: string
  url: string
  filename: string
  ocrText?: string
  songKey?: string
}

interface ImageCardProps {
  url: string
  filename: string
  ocrText?: string
  songKey?: string
  isFromGoogle?: boolean
  relatedPages?: RelatedPage[]
  totalPages?: number
  availableKeys?: string[]
}

export function ImageCard({
  url,
  filename,
  ocrText,
  songKey,
  isFromGoogle,
  relatedPages = [],
  totalPages = 1,
  availableKeys = [],
}: ImageCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)

  const title = ocrText?.split('\n').find(line => line.trim().length > 0)?.substring(0, 30) || filename

  // Combine main page with related pages for navigation
  const allPages = [
    { id: 'main', url, filename, ocrText, songKey },
    ...relatedPages,
  ]

  const currentPage = allPages[currentPageIndex]
  const hasMultiplePages = allPages.length > 1

  // Debug: Log URLs when dialog opens
  if (isOpen && hasMultiplePages) {
    console.log('[ImageCard] All pages URLs:')
    allPages.forEach((p, i) => {
      console.log(`  Page ${i + 1}: ${p.url}`)
    })
    console.log(`  Current page (${currentPageIndex + 1}): ${currentPage.url}`)
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(currentPage.url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${title}${currentPage.songKey ? `_${currentPage.songKey}` : ''}_p${currentPageIndex + 1}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch {
      window.open(currentPage.url, '_blank')
    }
  }

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    // Download all pages sequentially
    for (let i = 0; i < allPages.length; i++) {
      try {
        const response = await fetch(allPages[i].url)
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `${title}${songKey ? `_${songKey}` : ''}_p${i + 1}.jpg`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(downloadUrl)
        await new Promise(resolve => setTimeout(resolve, 300)) // Small delay between downloads
      } catch {
        window.open(allPages[i].url, '_blank')
      }
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const shareText = `${title}${songKey ? ` (${songKey})` : ''} 악보${hasMultiplePages ? ` (${allPages.length}페이지)` : ''}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareText,
          text: shareText,
          url: currentPage.url,
        })
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(currentPage.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const goToPreviousPage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageError(false) // Reset error state when changing pages
    setCurrentPageIndex(prev => Math.max(0, prev - 1))
  }

  const goToNextPage = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageError(false) // Reset error state when changing pages
    setCurrentPageIndex(prev => Math.min(allPages.length - 1, prev + 1))
  }

  return (
    <>
      <Card
        className="group cursor-pointer overflow-hidden border-border hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 active:scale-[0.98] bg-card"
        onClick={() => setIsOpen(true)}
      >
        <div className="relative aspect-[3/4] bg-muted">
          {/* Prominent Key Badge - Top Right */}
          {songKey && (
            <div className="absolute top-2 right-2 z-10">
              <span className="px-2.5 py-1 text-sm font-bold bg-amber-500 text-white rounded-lg shadow-lg">
                {songKey}
              </span>
            </div>
          )}

          {/* Multi-page Badge - Top Left */}
          {hasMultiplePages && (
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-1 text-[10px] font-medium bg-violet-500 text-white rounded-md flex items-center gap-1">
                <FileStack className="w-3 h-3" />
                {allPages.length}p
              </span>
            </div>
          )}

          {/* Web Badge - Top Left (when no multi-page) */}
          {isFromGoogle && !hasMultiplePages && (
            <div className="absolute top-2 left-2 z-10">
              <span className="px-2 py-1 text-[10px] font-medium bg-blue-500 text-white rounded-md flex items-center gap-1">
                <Globe className="w-3 h-3" />
                웹
              </span>
            </div>
          )}

          {/* Multiple Keys Badge - Bottom Left */}
          {availableKeys.length > 1 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="px-2 py-0.5 text-[9px] font-medium bg-emerald-500/90 text-white rounded-md">
                {availableKeys.length}개 키
              </span>
            </div>
          )}

          {!imageError ? (
            <Image
              src={url}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 200px"
              onError={() => setImageError(true)}
              unoptimized={isFromGoogle}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="p-2 sm:p-3 bg-card">
          <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 leading-tight">{title}</p>
        </div>
      </Card>

      {/* Full Screen Dialog with Multi-page Navigation */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) setCurrentPageIndex(0) // Reset to first page when closing
      }}>
        <DialogContent className="w-full max-w-[100vw] sm:max-w-4xl h-[100dvh] sm:h-[90vh] p-0 bg-black/95 border-none rounded-none sm:rounded-2xl flex flex-col" showCloseButton={false}>
          <DialogTitle className="sr-only">{title}</DialogTitle>

          {/* Header with title, key, and page indicator */}
          <div className="flex items-center justify-between p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-white/10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Current key badge */}
              {songKey && (
                <span className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-bold bg-amber-500 text-white rounded-lg shrink-0">
                  {songKey}
                </span>
              )}
              <h3 className="text-white font-medium text-xs sm:text-base truncate">{title}</h3>
              {hasMultiplePages && (
                <span className="text-white/60 text-xs sm:text-sm shrink-0">
                  {currentPageIndex + 1} / {allPages.length}
                </span>
              )}
              {/* Show other available keys */}
              {availableKeys.length > 1 && (
                <span className="text-white/50 text-xs shrink-0 hidden sm:inline">
                  +{availableKeys.filter(k => k !== songKey).join(', ')}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full h-8 w-8 shrink-0 ml-2"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Image with Navigation Arrows */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center">
            {/* Previous Page Button */}
            {hasMultiplePages && currentPageIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 z-10 text-white bg-black/50 hover:bg-black/70 rounded-full h-10 w-10 sm:h-12 sm:w-12"
                onClick={goToPreviousPage}
              >
                <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
              </Button>
            )}

            {/* Current Page Image */}
            <div className="relative w-full h-full">
              {!imageError ? (
                <Image
                  key={currentPage.url}
                  src={currentPage.url}
                  alt={`${title} - 페이지 ${currentPageIndex + 1}`}
                  fill
                  className="object-contain p-2 sm:p-4"
                  sizes="100vw"
                  priority
                  unoptimized={isFromGoogle}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Music className="w-12 h-12 sm:w-16 sm:h-16 text-white/30 mx-auto mb-2" />
                    <span className="text-sm sm:text-base text-white/50">이미지를 불러올 수 없습니다</span>
                  </div>
                </div>
              )}
            </div>

            {/* Next Page Button */}
            {hasMultiplePages && currentPageIndex < allPages.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 z-10 text-white bg-black/50 hover:bg-black/70 rounded-full h-10 w-10 sm:h-12 sm:w-12"
                onClick={goToNextPage}
              >
                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
              </Button>
            )}
          </div>

          {/* Page Dots */}
          {hasMultiplePages && (
            <div className="flex justify-center gap-1.5 py-2">
              {allPages.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentPageIndex
                      ? 'bg-amber-500 w-4'
                      : 'bg-white/30 hover:bg-white/50'
                  }`}
                  onClick={() => setCurrentPageIndex(index)}
                />
              ))}
            </div>
          )}

          {/* Action Buttons - Bottom */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/10 bg-black/50">
            {hasMultiplePages ? (
              <>
                <Button
                  variant="outline"
                  size="default"
                  className="flex-1 max-w-[120px] sm:max-w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  이 페이지
                </Button>
                <Button
                  variant="outline"
                  size="default"
                  className="flex-1 max-w-[120px] sm:max-w-[140px] bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10"
                  onClick={handleDownloadAll}
                >
                  <FileStack className="w-4 h-4" />
                  전체 ({allPages.length})
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="default"
                className="flex-1 max-w-[160px] bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2 h-10"
                onClick={handleDownload}
              >
                <Download className="w-5 h-5" />
                다운로드
              </Button>
            )}
            <Button
              variant="outline"
              size="default"
              className="flex-1 max-w-[120px] sm:max-w-[140px] bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10"
              onClick={handleShare}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  복사됨
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  공유
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
