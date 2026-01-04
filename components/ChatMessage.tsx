'use client'

import { ImageCard } from './ImageCard'

interface ChatImage {
  id: string
  url: string
  filename: string
  ocrText?: string
}

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  images?: ChatImage[]
}

export function ChatMessage({ role, content, images }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--gold-300)] to-[var(--gold-500)] flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        </div>
      )}

      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-gradient-to-br from-[var(--burgundy-600)] to-[var(--burgundy-700)] text-white rounded-2xl rounded-br-sm shadow-lg'
            : 'glass rounded-2xl rounded-bl-sm golden-glow'
        } px-5 py-3.5`}
      >
        <p className={`whitespace-pre-wrap leading-relaxed ${isUser ? 'text-white/95' : 'text-[var(--ink)]'}`}>
          {content}
        </p>

        {images && images.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <ImageCard
                  url={image.url}
                  filename={image.filename}
                  ocrText={image.ocrText}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--burgundy-500)] to-[var(--burgundy-700)] flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
