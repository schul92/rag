'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChatInput } from '@/components/ChatInput'
import { ImageCard } from '@/components/ImageCard'
import { useTheme } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { Music, Sparkles, Search, Settings, Sun, Moon, Globe, Loader2, BookOpen, Heart, Mic2, Star } from 'lucide-react'

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
}

export default function Home() {
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
    { term: 'G키 찬양 5개', icon: Music, color: 'text-emerald-500' },
    { term: '거룩하신 어린양', icon: Heart, color: 'text-rose-500' },
    { term: 'D키 악보 3개', icon: BookOpen, color: 'text-blue-500' },
  ]

  const isInitialState = messages.length <= 1

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

            {/* Settings Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-sm sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-lg">{t.settings}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Language Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
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
                      className="gap-2"
                    >
                      {language === 'ko' ? 'English' : '한국어'}
                    </Button>
                  </div>

                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? (
                        <Moon className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Sun className="h-5 w-5 text-amber-500" />
                      )}
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
                      className="gap-2"
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
              </DialogContent>
            </Dialog>
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
            <ScrollArea className="h-[calc(100dvh-180px)] sm:h-[calc(100dvh-200px)]" ref={scrollRef}>
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

                      {/* Key Selection Buttons */}
                      {msg.keyOptions && msg.keyOptions.length > 0 && (
                        <div className="mt-2 sm:mt-3">
                          <p className="text-xs text-muted-foreground mb-2">🎹 {t.keySelection}</p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {msg.keyOptions.map((key) => (
                              <Button
                                key={key}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSend(`${key} 키`)}
                                className="rounded-full text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-800/30"
                              >
                                {key}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.images && msg.images.length > 0 && (
                        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2 sm:gap-3">
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
                        <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <Card className="px-3 sm:px-4 py-3 sm:py-4 bg-card border-border rounded-2xl rounded-bl-md min-w-[200px] sm:min-w-[280px]">
                      <div className="space-y-3">
                        {/* Animated loading bar */}
                        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 rounded-full animate-loading-bar"
                            style={{
                              width: `${Math.min(20 + loadingPhase * 20, 95)}%`,
                              transition: 'width 0.5s ease-out'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>

                        {/* Loading message with icon */}
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                          <span
                            key={loadingPhase}
                            className="text-xs sm:text-sm text-foreground font-medium animate-fade-in"
                          >
                            {getLoadingMessage()}
                          </span>
                        </div>

                        {/* Phase indicator dots */}
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2, 3, 4].map((phase) => (
                            <div
                              key={phase}
                              className={`h-1 rounded-full transition-all duration-300 ${
                                phase <= loadingPhase
                                  ? 'w-3 bg-amber-500'
                                  : 'w-1.5 bg-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
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
