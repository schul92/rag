'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ChatInput } from '@/components/ChatInput'
import { ImageCard } from '@/components/ImageCard'
import { useTheme } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { Music, Sparkles, Search, Settings, Sun, Moon, Globe } from 'lucide-react'

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

  // Initialize welcome message with current language
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t.welcomeMessage,
    }])
  }, [t.welcomeMessage])
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    }
    setMessages((prev) => [...prev, userMessage])
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

  const quickSearches = ['거룩 영원히', 'Holy Forever', '주님이 주신 땅으로', '전능하신 나의 주']

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
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

      {/* Quick Search Pills */}
      {messages.length <= 1 && (
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 flex items-center gap-2">
            <Search className="w-3 h-3 sm:w-4 sm:h-4" />
            {t.quickSearch}
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {quickSearches.map((term) => (
              <Button
                key={term}
                variant="outline"
                size="sm"
                onClick={() => handleSend(term)}
                className="rounded-full text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              >
                {term}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        <ScrollArea className="h-[calc(100vh-240px)] sm:h-[calc(100vh-280px)]" ref={scrollRef}>
          <div className="space-y-4 sm:space-y-6 py-4 sm:py-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
              <div className="flex gap-2 sm:gap-3">
                <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-border shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <Music className="w-4 h-4 sm:w-5 sm:h-5" />
                  </AvatarFallback>
                </Avatar>
                <Card className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border-border rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground">{t.searching}</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="max-w-4xl mx-auto px-3 sm:px-4">
          <ChatInput onSend={handleSend} disabled={isLoading} />
          <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3">
            {t.inputHint}
          </p>
        </div>
      </div>
    </div>
  )
}
