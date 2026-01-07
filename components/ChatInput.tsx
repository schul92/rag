'use client'

import { useState, KeyboardEvent, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'
import LiquidGlass from 'liquid-glass-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useLanguage()
  const [message, setMessage] = useState('')
  const isComposingRef = useRef(false)

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Skip if IME is composing (important for Korean/Japanese/Chinese input)
    if (e.nativeEvent.isComposing || isComposingRef.current) {
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <LiquidGlass
      className="flex gap-2 sm:gap-3 items-center"
      padding="6px 8px"
      cornerRadius={16}
      blurAmount={0.15}
      saturation={120}
      elasticity={0.25}
    >
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposingRef.current = true }}
        onCompositionEnd={() => { isComposingRef.current = false }}
        placeholder={t.inputPlaceholder}
        className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base placeholder:text-muted-foreground h-10 sm:h-12"
        disabled={disabled}
      />
      <LiquidGlass
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        cornerRadius={12}
        padding="10px"
        blurAmount={0.1}
        saturation={130}
        elasticity={0.35}
        className={`shrink-0 cursor-pointer ${disabled || !message.trim() ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <Send className="w-5 h-5 text-foreground" />
      </LiquidGlass>
    </LiquidGlass>
  )
}
