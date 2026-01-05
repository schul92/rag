'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChatInput } from '@/components/ChatInput'
import { ImageCard } from '@/components/ImageCard'
import { useTheme } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { useMediaQuery } from '@/hooks/use-media-query'
import { Music, Sparkles, Search, Settings, Sun, Moon, Globe, Loader2, BookOpen, Heart, Star, X, ChevronLeft, ChevronRight } from 'lucide-react'
// Carousel disabled - using grid layout instead

interface RelatedPage {
  id: string
  url: string
  filename: string
  ocrText?: string
  songKey?: string
}

interface ChatImage {
  id: string
  url: string
  filename: string
  ocrText?: string
  songKey?: string
  isFromGoogle?: boolean
  relatedPages?: RelatedPage[]
  totalPages?: number
  availableKeys?: string[]
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: ChatImage[]
  keyOptions?: string[]  // Available keys for user to select
  googleSearchUrl?: string  // URL to Google Images when API limit reached
}

export default function Home() {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [mounted, setMounted] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

  // Prevent hydration mismatch from browser extensions (like Dark Reader)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize welcome message with current language
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t.welcomeMessage,
    }])
  }, [t.welcomeMessage])

  // Progressive loading phases
  useEffect(() => {
    if (!isLoading) {
      setLoadingPhase(0)
      return
    }

    // Phase timings: 0ms, 800ms, 2000ms, 4000ms, 6000ms
    const timers = [
      setTimeout(() => setLoadingPhase(1), 800),
      setTimeout(() => setLoadingPhase(2), 2000),
      setTimeout(() => setLoadingPhase(3), 4000),
      setTimeout(() => setLoadingPhase(4), 6000),
    ]

    return () => timers.forEach(timer => clearTimeout(timer))
  }, [isLoading])

  // Get current loading message based on phase
  const getLoadingMessage = useCallback(() => {
    switch (loadingPhase) {
      case 0:
        return t.loadingPhase1
      case 1:
        return t.loadingPhase2(currentQuery)
      case 2:
        return t.loadingPhase3
      case 3:
        return t.loadingPhase4
      case 4:
        return t.loadingPhase5
      default:
        return t.searching
    }
  }, [loadingPhase, currentQuery, t])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Use scrollIntoView for better mobile compatibility
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isLoading])

  const handleSend = async (message: string) => {
    // Store query for loading message
    setCurrentQuery(message)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    }

    // Immediately show user message
    setMessages((prev) => [...prev, userMessage])

    // Start loading after a tiny delay to ensure message renders first
    await new Promise(resolve => setTimeout(resolve, 50))
    setIsLoading(true)

    try {
      // Include last 3 messages for context (memory)
      const recentHistory = messages.slice(-3).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language, history: recentHistory }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        images: data.images,
        keyOptions: data.needsKeySelection ? data.availableKeys : undefined,
        googleSearchUrl: data.googleSearchUrl,  // For API limit fallback
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t.errorMessage,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const quickSearches = [
    { term: '오 베들레헴', icon: Star, color: 'text-amber-500' },
    { term: '내 평생 사는 동안', icon: Heart, color: 'text-rose-500' },
    { term: '지극히 높으신 주', icon: Sparkles, color: 'text-purple-500' },
    { term: 'G키 찬양 5개', icon: Music, color: 'text-emerald-500' },
    { term: '광대하신 주님', icon: Star, color: 'text-blue-500' },
    { term: '예수로 나의 구주 삼고', icon: Heart, color: 'text-pink-500' },
  ]

  const isInitialState = messages.length <= 1

  // Show loading skeleton until mounted to prevent hydration mismatch from browser extensions
  if (!mounted) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col">
        <header className="shrink-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-background transition-colors duration-300 flex flex-col ${isInitialState ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'}`}>
      {/* Header */}
      <header className="shrink-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Music className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-rose-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground">
                  {t.appTitle}
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground tracking-wider">{t.appSubtitle}</p>
              </div>
            </div>

            {/* Settings Button - Responsive: Dialog on desktop, Drawer on mobile */}
            {isDesktop ? (
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-muted transition-colors">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-sm sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-lg">{t.settings}</DialogTitle>
                  </DialogHeader>
                  <SettingsContent
                    language={language}
                    setLanguage={setLanguage}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    t={t}
                  />
                </DialogContent>
              </Dialog>
            ) : (
              <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DrawerTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 hover:bg-muted transition-colors">
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="text-center">
                    <DrawerTitle>{t.settings}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-8">
                    <SettingsContent
                      language={language}
                      setLanguage={setLanguage}
                      theme={theme}
                      toggleTheme={toggleTheme}
                      t={t}
                    />
                  </div>
                </DrawerContent>
              </Drawer>
            )}
          </div>
        </div>
      </header>

      {/* Initial State - Modern Centered Layout */}
      {isInitialState ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-3xl mx-auto">
          {/* Centered Branding */}
          <div className="text-center mb-8 sm:mb-12 animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4 sm:mb-6">
              <Music className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-2">
              {t.welcomeMessage.split('!')[0]}!
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t.inputHint}
            </p>
          </div>

          {/* Large Centered Search Input */}
          <div className="w-full mb-6 sm:mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="relative">
              <div className="flex gap-2 sm:gap-3 items-center p-2 sm:p-3 bg-card rounded-2xl sm:rounded-3xl shadow-lg border border-border hover:border-amber-500/50 transition-colors">
                <div className="pl-2 sm:pl-3">
                  <Search className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t.inputPlaceholder}
                  className="flex-1 bg-transparent border-0 outline-none text-sm sm:text-lg text-foreground placeholder:text-muted-foreground py-2 sm:py-3"
                  onCompositionStart={() => { isComposingRef.current = true }}
                  onCompositionEnd={() => { isComposingRef.current = false }}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    // Skip if IME is composing (important for Korean/Japanese/Chinese input)
                    if (e.nativeEvent.isComposing || isComposingRef.current) {
                      return
                    }
                    if (e.key === 'Enter' && searchInput.trim()) {
                      handleSend(searchInput.trim())
                      setSearchInput('')
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shrink-0"
                  onClick={() => {
                    if (searchInput.trim()) {
                      handleSend(searchInput.trim())
                      setSearchInput('')
                    }
                  }}
                >
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </Button>
              </div>
            </div>
          </div>

          {/* Modern Quick Search Pills */}
          <div className="w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {quickSearches.map(({ term, icon: Icon, color }) => (
                <button
                  key={term}
                  onClick={() => handleSend(term)}
                  className="group flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-card hover:bg-muted border border-border hover:border-amber-500/50 rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color} transition-transform group-hover:scale-110`} />
                  <span className="text-sm sm:text-base font-medium text-foreground">{term}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bottom spacing for safe area */}
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      ) : (
        <>
          {/* Messages Area - Scrollable */}
          <div className="flex-1 max-w-4xl mx-auto px-3 sm:px-4 w-full overflow-hidden">
            <ScrollArea className="h-[calc(100dvh-160px)] sm:h-[calc(100dvh-180px)]" ref={scrollRef}>
              <div className="space-y-4 sm:space-y-6 py-4 sm:py-6 pb-20">
                {messages.map((msg, index) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 sm:gap-3 animate-fade-in-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-border shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                          <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={`max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <Card
                        className={`px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none rounded-2xl rounded-br-md'
                            : 'bg-card border-border rounded-2xl rounded-bl-md'
                        }`}
                      >
                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </Card>

                      {/* Key Selection Badges */}
                      {msg.keyOptions && msg.keyOptions.length > 0 && (
                        <div className="mt-2 sm:mt-3">
                          <p className="text-xs text-muted-foreground mb-2">{t.keySelection}</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {msg.keyOptions.map((key) => (
                              <Badge
                                key={key}
                                variant="outline"
                                className="cursor-pointer text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-300 dark:border-amber-700 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-800/40 dark:hover:to-orange-800/40 hover:scale-105 transition-all duration-200 active:scale-95"
                                onClick={() => handleSend(`${key} 키`)}
                              >
                                <Music className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
                                {key}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Google Search Fallback Button */}
                      {msg.googleSearchUrl && (
                        <div className="mt-3">
                          <a
                            href={msg.googleSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/25"
                          >
                            <Search className="w-4 h-4" />
                            {language === 'ko' ? 'Google에서 검색하기' : 'Search on Google'}
                          </a>
                        </div>
                      )}

                      {msg.images && msg.images.length > 0 && (
                        <div className="mt-2 sm:mt-3">
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            {msg.images[0]?.isFromGoogle ? (
                              <>
                                <Globe className="w-3 h-3" />
                                {language === 'ko' ? `웹 검색 결과 ${msg.images.length}개` : `${msg.images.length} web results`}
                              </>
                            ) : (
                              <>
                                <Music className="w-3 h-3" />
                                {language === 'ko' ? `검색 결과 ${msg.images.length}개` : `${msg.images.length} results`}
                              </>
                            )}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                            {msg.images.map((image) => (
                              <ImageCard
                                key={image.id}
                                url={image.url}
                                filename={image.filename}
                                ocrText={image.ocrText}
                                songKey={image.songKey}
                                isFromGoogle={image.isFromGoogle}
                                relatedPages={image.relatedPages}
                                totalPages={image.totalPages}
                                availableKeys={image.availableKeys}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-border shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-rose-400 to-pink-500 text-white text-xs sm:text-sm font-medium">
                          {t.me}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 sm:gap-3 animate-fade-in-up">
                    <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-border shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <Music className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                      </AvatarFallback>
                    </Avatar>
                    <Card className="px-3 sm:px-4 py-3 sm:py-4 bg-card border-border rounded-2xl rounded-bl-md min-w-[200px] sm:min-w-[280px] shadow-lg">
                      <div className="space-y-3">
                        {/* Progress bar with gradient */}
                        <div className="relative">
                          <Progress
                            value={Math.min(20 + loadingPhase * 20, 95)}
                            className="h-2 bg-muted [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full" />
                        </div>

                        {/* Loading message with icon */}
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                            <div className="absolute inset-0 w-4 h-4 bg-amber-500/20 rounded-full animate-ping" />
                          </div>
                          <span
                            key={loadingPhase}
                            className="text-xs sm:text-sm text-foreground font-medium animate-fade-in"
                          >
                            {getLoadingMessage()}
                          </span>
                        </div>

                        {/* Phase indicator with badges */}
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2, 3, 4].map((phase) => (
                            <div
                              key={phase}
                              className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                                phase <= loadingPhase
                                  ? 'w-4 bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm shadow-amber-500/50'
                                  : 'w-2 bg-muted-foreground/20'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Scroll anchor for auto-scroll */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-4 sm:pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="max-w-4xl mx-auto px-3 sm:px-4">
              <ChatInput onSend={handleSend} disabled={isLoading} />
              <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2">
                {t.inputHint}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Shared Settings Content Component
interface SettingsContentProps {
  language: string
  setLanguage: (lang: 'ko' | 'en') => void
  theme: string
  toggleTheme: () => void
  t: {
    language: string
    theme: string
    darkMode: string
    lightMode: string
    light: string
    dark: string
  }
}

function SettingsContent({ language, setLanguage, theme, toggleTheme, t }: SettingsContentProps) {
  return (
    <div className="space-y-4 py-4">
      {/* Language Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{t.language}</p>
            <p className="text-xs text-muted-foreground">
              {language === 'ko' ? '한국어' : 'English'}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
          className="gap-2 rounded-full hover:scale-105 active:scale-95 transition-transform"
        >
          {language === 'ko' ? 'EN' : '한'}
        </Button>
      </div>

      {/* Theme Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            theme === 'dark' ? 'bg-indigo-500/10' : 'bg-amber-500/10'
          }`}>
            {theme === 'dark' ? (
              <Moon className="h-5 w-5 text-indigo-400" />
            ) : (
              <Sun className="h-5 w-5 text-amber-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">{t.theme}</p>
            <p className="text-xs text-muted-foreground">
              {theme === 'dark' ? t.darkMode : t.lightMode}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="gap-2 rounded-full hover:scale-105 active:scale-95 transition-transform"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4" />
              {t.light}
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              {t.dark}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
