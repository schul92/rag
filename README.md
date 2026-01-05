# PraiseFlow - Worship Song Chord Sheet Finder

A bilingual (Korean/English) AI-powered search system for finding worship song chord sheets. Built with RAG (Retrieval-Augmented Generation) architecture using **Gemini 3 Pro** for OCR/metadata extraction and **8-way hybrid search** with Cohere reranking.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Gemini](https://img.shields.io/badge/Gemini_3_Pro-OCR-yellow)
![Claude](https://img.shields.io/badge/Claude-Fallback-orange)

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [RAG Workflow](#rag-workflow)
- [Database Schema](#database-schema)
- [Search Algorithm](#search-algorithm)
- [API Reference](#api-reference)
- [Setup Guide](#setup-guide)
- [Cost Analysis](#cost-analysis)
- [Project Structure](#project-structure)

---

## Overview

PraiseFlow helps worship teams find chord sheets by searching through a database of scanned/photographed sheet music. Users can search in Korean or English, and the system handles:

- **Korean text variations**: "위대하신주" = "위대하신 주" = "위 대 하 신 주"
- **Cross-language search**: "Holy Forever" finds "거룩 영원히"
- **Typo tolerance**: "위대하신쥬" -> "위대하신주"
- **Multi-page sheets**: Automatically groups pages together
- **Key selection**: Filter by musical key (G, A, C, Dm, etc.)

---

## Tech Stack

| Layer | Technology | Purpose | Cost |
|-------|------------|---------|------|
| **Frontend** | Next.js 15 (App Router) | React framework with server components | Free |
| **UI** | shadcn/ui + Tailwind CSS | Component library and styling | Free |
| **Database** | Supabase (PostgreSQL + pgvector) | Data storage + lyrics_chunks table | Free/$25mo |
| **Vector Search** | Voyage AI | voyage-multilingual-2 (1024d Korean-optimized) | ~$0.0001/query |
| **OCR/Extraction** | Gemini 3 Pro Vision | Extract metadata from chord sheet images | $1.25/1K images |
| **Reranking** | Cohere Rerank 3 | Cross-encoder reranking (Vercel-optimized) | ~$0.002/query |
| **AI Chat** | Claude Sonnet | Fallback when no results found | $3-15/1M tokens |
| **Storage** | Supabase Storage | Image file hosting | Included |
| **Language** | TypeScript | Type-safe development | Free |

---

## Architecture

```
+---------------------------------------------------------------------+
|                    PRAISEFLOW SYSTEM v2.0                           |
+---------------------------------------------------------------------+

+---------------------------------------------------------------------+
|                    1. IMAGE INGESTION PIPELINE                      |
|                       (One-time per image)                          |
+---------------------------------------------------------------------+
|                                                                     |
|   Local Images --> Gemini 3 Pro --> Voyage AI --> Supabase          |
|   (JPG/PNG)        (Vision/OCR)     (Dual Embed)  (Store all)       |
|                                                                     |
|   Gemini 3 Pro Extracts:                                            |
|   - song_title (original language)                                  |
|   - song_title_korean                                               |
|   - song_title_english                                              |
|   - song_key (G, A, Dm, etc.) ← Key-aware deduplication             |
|   - ocr_text (full page text)                                       |
|                                                                     |
|   Voyage AI Generates:                                              |
|   - embedding (512d voyage-3-lite)                                  |
|   - embedding_multilingual (1024d voyage-multilingual-2) ← Korean   |
|                                                                     |
|   Lyrics Chunking:                                                  |
|   - Split OCR text into lines → lyrics_chunks table                 |
|   - Each chunk gets 1024d multilingual embedding                    |
|                                                                     |
+---------------------------------------------------------------------+

+---------------------------------------------------------------------+
|                    2. HYBRID SEARCH PIPELINE                        |
|                     (Every user query)                              |
+---------------------------------------------------------------------+
|                                                                     |
|   User Query --> Preprocess --> 8 PARALLEL SEARCHES --> RRF Fusion  |
|   "Holy Forever"                                                    |
|                                                                     |
|   ┌─────────────────────────────────────────────────────────────┐   |
|   │           ALL 8 METHODS RUN IN PARALLEL                     │   |
|   │                  (using Promise.all)                        │   |
|   │                                                             │   |
|   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐        │   |
|   │  │ EXACT │ │ BM25  │ │NORMAL │ │ ALIAS │ │ FUZZY │        │   |
|   │  │ ILIKE │ │  FTS  │ │KOREAN │ │LOOKUP │ │LEVEN- │        │   |
|   │  │       │ │       │ │       │ │       │ │SHTEIN │        │   |
|   │  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘        │   |
|   │      │         │         │         │         │             │   |
|   │  ┌───┴───┐ ┌───┴───┐ ┌───┴───┐                            │   |
|   │  │VECTOR │ │  OCR  │ │LYRICS │                            │   |
|   │  │MULTI- │ │ TEXT  │ │CHUNKS │  ← All use 1024d           │   |
|   │  │LINGUAL│ │       │ │       │    multilingual            │   |
|   │  └───┬───┘ └───┬───┘ └───┬───┘                            │   |
|   │      │         │         │                                 │   |
|   └──────┼─────────┼─────────┼─────────────────────────────────┘   |
|          │         │         │                                     |
|          ▼         ▼         ▼                                     |
|   ┌─────────────────────────────────────────────────────────────┐   |
|   │         RECIPROCAL RANK FUSION (RRF)                        │   |
|   │         Score = Σ 1/(60 + rank)                             │   |
|   └─────────────────────────────────────────────────────────────┘   |
|                              │                                      |
|                              ▼                                      |
|   ┌─────────────────────────────────────────────────────────────┐   |
|   │              COHERE RERANKING                               │   |
|   │                                                             │   |
|   │   Model: rerank-multilingual-v3.0                          │   |
|   │   Latency: ~200-400ms (Vercel-optimized)                   │   |
|   └─────────────────────────────────────────────────────────────┘   |
|                                                                     |
+---------------------------------------------------------------------+

+---------------------------------------------------------------------+
|                    3. RESPONSE GENERATION                           |
+---------------------------------------------------------------------+
|                                                                     |
|   Results Found?                                                    |
|        |                                                            |
|   +----+----+                                                       |
|   |         |                                                       |
|  YES        NO                                                      |
|   |         |                                                       |
|   v         v                                                       |
| Smart     Claude AI                                                 |
| Response  Assistance                                                |
| (FREE)    (~$0.003)                                                 |
|                                                                     |
+---------------------------------------------------------------------+

COST PER QUERY: ~$0.003 (Voyage + Cohere)
ONE-TIME BATCH: ~$0.62 (Gemini OCR for 498 images)
```

---

## RAG Workflow

### What is RAG?

**RAG (Retrieval-Augmented Generation)** combines search (retrieval) with AI generation. Instead of relying solely on an AI's training data, we:

1. **Retrieve** relevant documents from our database
2. **Augment** the AI prompt with this context
3. **Generate** a response based on actual data

### Our RAG Implementation

#### Phase 1: Document Ingestion (One-time setup)

```
+---------------------------------------------------------------+
|  STEP 1: IMAGE UPLOAD                                         |
|  Script: scripts/process-images.ts                            |
|                                                               |
|  - Read images from local folder                              |
|  - Compute MD5 hash for duplicate detection                   |
|  - Skip already-processed images                              |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 2: GEMINI 3 PRO VISION EXTRACTION                       |
|  API: gemini-3-pro-preview (Top-tier OCR as of Jan 2026)      |
|  Cost: ~$0.00125 per image                                    |
|                                                               |
|  Prompt: "Extract song metadata as JSON..."                   |
|                                                               |
|  Output:                                                      |
|  {                                                            |
|    "song_title": "Holy Forever",                              |
|    "song_title_korean": "거룩 영원히",                        |
|    "song_key": "D",  ← Key-aware (same title, diff key = OK)  |
|    "ocr_text": "Holy Forever\nCEC Worship\n..."               |
|  }                                                            |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 3: DUAL EMBEDDING GENERATION                            |
|  API: Voyage AI                                               |
|                                                               |
|  1. voyage-3-lite (512d) - General purpose                    |
|     Cost: ~$0.00006 per embedding                             |
|                                                               |
|  2. voyage-multilingual-2 (1024d) - Korean optimized          |
|     Cost: ~$0.00012 per embedding                             |
|                                                               |
|  Input: Combined text (title + korean + english + ocr_text)   |
|  Output: Both vectors stored for hybrid search                |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 4: LYRICS CHUNKING (for partial lyrics search)          |
|                                                               |
|  - Split ocr_text into individual lines                       |
|  - Generate 1024d multilingual embedding per line             |
|  - Store in lyrics_chunks table                               |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 5: STORAGE                                              |
|  Database: Supabase (PostgreSQL + pgvector)                   |
|                                                               |
|  - Upload image to Supabase Storage                           |
|  - Insert metadata + embedding into song_images table         |
|  - Create indexes for fast search                             |
+---------------------------------------------------------------+
```

#### Phase 2: Query Processing (Every search)

```
+---------------------------------------------------------------+
|  STEP 1: QUERY NORMALIZATION                                  |
|                                                               |
|  Input: "거룩 영원히 악보 찾아줘"                             |
|                                                               |
|  Process:                                                     |
|  1. Remove filler words: 악보, 찾아줘, 코드, key, sheet...    |
|  2. Result: "거룩 영원히"                                     |
|  3. Normalize Korean: "거룩영원히" (NFC + remove spaces)      |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 2: PARALLEL SEARCH (All run simultaneously)             |
|                                                               |
|  +-------------------------------------------------------+   |
|  | EXACT MATCH (Score: 1.0)                              |   |
|  | SELECT * FROM song_images                             |   |
|  | WHERE song_title ILIKE '%거룩 영원히%'                |   |
|  +-------------------------------------------------------+   |
|                                                               |
|  +-------------------------------------------------------+   |
|  | NORMALIZED MATCH (Score: 0.95)                        |   |
|  | Compare: normalizeKorean(song_title) with query       |   |
|  | Handles: "거룩영원히" = "거룩 영원히"                 |   |
|  +-------------------------------------------------------+   |
|                                                               |
|  +-------------------------------------------------------+   |
|  | ALIAS MATCH (Score: 0.95)                             |   |
|  | SELECT * FROM song_aliases                            |   |
|  | WHERE alias ILIKE '%Holy Forever%'                    |   |
|  | -> Returns Korean song "거룩 영원히"                  |   |
|  +-------------------------------------------------------+   |
|                                                               |
|  +-------------------------------------------------------+   |
|  | FUZZY MATCH (Score: similarity x 0.8)                 |   |
|  | Uses calculateSimilarity() for typo handling          |   |
|  | "위대하신쥬" -> "위대하신주" (similarity: 0.85)       |   |
|  +-------------------------------------------------------+   |
|                                                               |
|  +-------------------------------------------------------+   |
|  | VECTOR SEARCH (Score: ~0.7) - Only if above return 0  |   |
|  | 1. Generate embedding for query via Voyage AI         |   |
|  | 2. SELECT * FROM song_images                          |   |
|  |    ORDER BY embedding <=> query_embedding             |   |
|  | 3. Return semantically similar songs                  |   |
|  +-------------------------------------------------------+   |
|                                                               |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 3: SCORE AGGREGATION                                    |
|                                                               |
|  - Merge results from all search methods                      |
|  - Keep highest score per song (deduplicate)                  |
|  - Sort by score descending                                   |
|  - Group multi-page sheets together                           |
|  - Limit to top 3 results                                     |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  STEP 4: RESPONSE GENERATION                                  |
|                                                               |
|  IF results.length > 0:                                       |
|    -> Generate smart response (FREE, no API call)             |
|    -> "'Holy Forever' (D키) 악보입니다."                      |
|                                                               |
|  ELSE:                                                        |
|    -> Call Claude Sonnet API (~$0.003)                        |
|    -> "검색 결과가 없습니다. 다른 키워드로 시도해 보세요."    |
+---------------------------------------------------------------+
```

---

## Database Schema

### Tables

#### `song_images` - Main song data

```sql
CREATE TABLE song_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Image data
  image_url TEXT NOT NULL,           -- Supabase Storage URL
  original_filename TEXT,            -- Original file name

  -- Extracted metadata (from Claude Vision)
  song_title TEXT,                   -- Main title
  song_title_korean TEXT,            -- Korean translation
  song_title_english TEXT,           -- English translation
  song_key TEXT,                     -- Musical key (G, A, Dm, etc.)
  artist TEXT,                       -- Composer/songwriter
  ocr_text TEXT,                     -- Full extracted text
  lyrics_excerpt TEXT,               -- First few lines

  -- Vector embedding (from Voyage AI)
  embedding VECTOR(1024),            -- Semantic search vector

  -- Grouping
  song_group_id UUID,                -- Groups multi-page sheets
  page_number INT,                   -- Page order

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast search
CREATE INDEX idx_song_title ON song_images(song_title);
CREATE INDEX idx_song_key ON song_images(song_key);
CREATE INDEX idx_embedding ON song_images
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### `song_aliases` - Cross-language mappings

```sql
CREATE TABLE song_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_title TEXT NOT NULL,          -- Canonical title in song_images
  alias TEXT NOT NULL,               -- Alternative name
  language VARCHAR(10),              -- 'ko', 'en', 'romanized'
  alias_type VARCHAR(20),            -- 'official', 'common', 'translation'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_title, alias)
);

-- Example data
INSERT INTO song_aliases (song_title, alias, language, alias_type) VALUES
('Holy Forever', '거룩 영원히', 'ko', 'translation'),
('Holy Forever', '홀리 포에버', 'ko', 'romanized'),
('위대하신 주', 'How Great Is Our God', 'en', 'translation');
```

### Database Functions

#### Vector similarity search

```sql
CREATE FUNCTION search_songs_by_embedding(
  query_embedding VECTOR(1024),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  song_title TEXT,
  image_url TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.song_title,
    s.image_url,
    1 - (s.embedding <=> query_embedding) as similarity
  FROM song_images s
  WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Search Algorithm

### The 8 Parallel Search Methods

| # | Method | Description | Example |
|---|--------|-------------|---------|
| 1 | **Exact (ILIKE)** | SQL substring match on titles | "Holy" → "**Holy** Forever" |
| 2 | **BM25 (FTS)** | PostgreSQL full-text search with relevance ranking | "forever holy" → ranked results |
| 3 | **Normalized Korean** | Match after removing spaces, NFC normalization | "위대하신주" = "위대하신 주" |
| 4 | **Alias Lookup** | Cross-language mapping table | "Holy Forever" → "거룩 영원히" |
| 5 | **Fuzzy (Levenshtein)** | Handles typos using edit distance | "위대하신쥬" → "위대하신주" |
| 6 | **Vector (multilingual)** | voyage-multilingual-2 (1024d) Korean-optimized | "praise about glory" → related |
| 7 | **OCR Text** | Search in extracted image text | Find by lyrics content |
| 8 | **Lyrics Chunks** | Partial lyrics line matching | "나를 향한 주의 사랑" → finds song |

> **Note:** We use only `voyage-multilingual-2` (1024d) for all vector operations. This model is specifically optimized for Korean ↔ English bilingual search, outperforming general models for our use case.

### Reranking Pipeline (Cohere)

After RRF fusion combines results from all 8 methods:

| Stage | Model | Purpose | Latency |
|-------|-------|---------|---------|
| 1 | **Cohere rerank-multilingual-v3.0** | Cross-encoder reranking | ~200-400ms |

> **Note:** We use Cohere only (not BGE) for Vercel deployment. BGE via HuggingFace has cold starts and timeouts that are unreliable for serverless.

### Reciprocal Rank Fusion (RRF)

**Why not use raw scores?**
```
Vector score: 0.85   (cosine similarity 0-1)
BM25 score:   12.4   (relevance score 0-∞)
Fuzzy score:  0.72   (Levenshtein ratio 0-1)

These are NOT comparable! Different scales.
```

**RRF Solution: Use RANK position instead**
```
Formula: RRF(d) = Σ 1/(k + rank(d))  where k = 60

Example for "Holy Forever" found by 3 methods:
- Exact search:  rank 1 → 1/(60+1) = 0.0164
- BM25 search:   rank 2 → 1/(60+2) = 0.0161
- Vector search: rank 5 → 1/(60+5) = 0.0154
────────────────────────────────────────────
  Combined RRF score:      = 0.0479

Documents found by MULTIPLE methods get naturally boosted!
```

### Old vs New Scoring (Deprecated)

| Method | Old Score | New (RRF) |
|--------|-----------|-----------|
| Exact Title | 1.0 | By rank position |
| Normalized | 0.95 | By rank position |
| Alias Match | 0.95 | By rank position |
| Fuzzy | sim × 0.8 | By rank position |
| Vector | ~0.7 | By rank position |
| OCR | 0.75 | By rank position |

### Korean Normalization

```typescript
function normalizeKorean(text: string): string {
  return text
    .normalize('NFC')      // Unicode normalization
    .replace(/\s+/g, '')   // Remove ALL spaces
    .toLowerCase()         // Case insensitive
}

// Examples:
// "거룩 영원히" -> "거룩영원히"
// "위 대 하 신 주" -> "위대하신주"
// "Holy Forever" -> "holyforever"
```

### Multi-page Sheet Grouping

```typescript
// Group sheets by filename pattern + song title
function getBaseFilename(filename: string): string {
  // "Holy_Forever_1.jpg" -> "holy_forever"
  // "Holy_Forever_2.jpg" -> "holy_forever"
  // Both group together as multi-page sheet
}

// Only group if:
// 1. Same base filename pattern
// 2. Same song_title (prevents mixing different songs)
```

---

## API Reference

### POST `/api/chat`

Main search endpoint.

**Request:**
```typescript
{
  message: string      // User's search query
  language?: 'ko'|'en' // UI language (auto-detect if not provided)
  history?: Array<{    // Conversation context (last 3 messages)
    role: 'user' | 'assistant'
    content: string
  }>
}
```

**Response:**
```typescript
{
  message: string           // Assistant's response text
  images: Array<{
    id: string
    url: string             // Image URL
    filename: string
    ocrText: string         // Extracted text
    songKey: string         // Musical key
    score: number           // Match confidence (0-1)
    matchType: 'exact' | 'normalized' | 'alias' | 'fuzzy' | 'vector'
    matchedOn: string       // What text matched
    relatedPages: Array<{   // Other pages of same sheet
      id: string
      url: string
      filename: string
      songKey: string
    }>
    totalPages: number
    availableKeys: string[] // All available keys for this song
  }>
  needsKeySelection: boolean
  availableKeys: string[]
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Holy Forever", "language": "en"}'
```

---

## Setup Guide

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- Anthropic API key (Claude)
- Voyage AI API key

### 1. Clone and Install

```bash
git clone https://github.com/schul92/rag.git
cd rag
pnpm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Voyage AI (Embeddings)
VOYAGE_API_KEY=pa-...
```

### 3. Database Setup

Run in Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Run the setup scripts
-- 1. scripts/supabase-setup.sql (creates tables)
-- 2. scripts/add-metadata-columns.sql (adds Claude Vision columns)
-- 3. scripts/add-aliases-table.sql (cross-language search)
```

### 4. Process Images

Place chord sheet images in a folder, then:

```bash
# Edit the source path in scripts/process-images.ts
# Then run:
pnpm tsx scripts/process-images.ts
```

This will:
1. Extract metadata using Claude Vision
2. Generate embeddings via Voyage AI
3. Upload images to Supabase Storage
4. Insert records into database

### 5. Run Development Server

```bash
pnpm dev
```

Open http://localhost:3000

---

## Cost Analysis

### One-time Extraction Costs (v2.0)

| API | Per Image | 100 Images | 500 Images |
|-----|-----------|------------|-------------|
| Gemini 3 Pro Vision | $0.00125 | $0.125 | $0.62 |
| Voyage AI (voyage-3-lite) | $0.00006 | $0.006 | $0.03 |
| Voyage AI (multilingual) | $0.00012 | $0.012 | $0.06 |
| **Total** | **$0.0014** | **$0.14** | **$0.71** |

### Runtime Search Costs (v2.0)

| Service | Cost | Notes |
|---------|------|-------|
| Supabase queries | $0 | Free tier / $25/mo Pro |
| Voyage AI (multilingual) | ~$0.0001 | Per query embedding |
| Cohere Rerank 3 | ~$0.002 | $2/1K searches |
| Claude Chat (fallback) | ~$0.003 | Only when no results |

**Average cost per search: ~$0.002** (Voyage + Cohere)

---

## Project Structure

```
rag/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts        # Main search API
│   │   └── search/
│   │       └── route.ts        # Alternative search endpoint
│   ├── globals.css             # Tailwind styles
│   ├── layout.tsx              # Root layout with providers
│   └── page.tsx                # Main chat interface
│
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── ChatInput.tsx           # Search input component
│   ├── ImageCard.tsx           # Song sheet card with dialog
│   ├── LanguageProvider.tsx    # i18n context
│   └── ThemeProvider.tsx       # Dark/light theme
│
├── lib/
│   ├── hybrid-search.ts        # 8 parallel search methods + RRF
│   ├── reranker.ts             # Cross-encoder reranking (Cohere)
│   ├── claude.ts               # Claude API utilities
│   ├── embeddings.ts           # Voyage AI integration
│   ├── i18n.ts                 # Translations (ko/en)
│   ├── supabase.ts             # Supabase client
│   └── utils.ts                # Helper functions
│
├── scripts/
│   ├── process-images.ts       # Full ingestion pipeline
│   ├── extract-metadata-vision.ts  # Claude Vision extraction
│   ├── add-fts-search.sql      # BM25 full-text search migration
│   ├── run-fts-migration.ts    # Verify FTS setup
│   ├── supabase-setup.sql      # Database schema
│   ├── add-aliases-table.sql   # Cross-language aliases
│   └── ...
│
├── .env.local                  # Environment variables (git-ignored)
├── .env.example                # Example env template
└── README.md                   # This file
```

---

## Key Files Explained

### `app/api/chat/route.ts`
The heart of the search system. Contains:
- Query normalization (Korean handling)
- Parallel search execution
- Score aggregation and deduplication
- Multi-page sheet grouping
- Response generation

### `scripts/process-images.ts`
Image ingestion pipeline:
- Reads local images
- Calls Claude Vision for metadata
- Generates Voyage AI embeddings
- Uploads to Supabase

### `lib/i18n.ts`
Bilingual support:
- All UI strings in Korean and English
- Dynamic message generation

### `components/ImageCard.tsx`
Song sheet display:
- Thumbnail with key badge
- Full-screen dialog viewer
- Multi-page navigation
- Download functionality

---

## Development Tips

### Adding New Songs

1. Place images in your source folder
2. Run `pnpm tsx scripts/process-images.ts`
3. Images are processed with 25s delay (API rate limits)

### Adding Song Aliases

```sql
INSERT INTO song_aliases (song_title, alias, language, alias_type)
VALUES ('Your Song Title', 'Alternative Name', 'en', 'common');
```

### Debugging Search

The API returns debug info:
```typescript
_debug: {
  usedClaude: boolean,      // Was Claude API called?
  rawResultCount: number,   // Before grouping
  groupedCount: number,     // After grouping
  shownCount: number,       // Final results
  needsHelp: boolean        // User needs assistance?
}
```

### Adjusting Search Configuration

In `app/api/chat/route.ts`:
```typescript
// Feature flags
const USE_HYBRID_SEARCH = true   // Enable 7-method parallel + RRF
const USE_RERANKING = true       // Enable cross-encoder reranking
const RERANK_TOP_N = 10          // Candidates to rerank

// Thresholds
const SIMILARITY_THRESHOLD_LOW = 0.50  // Vector search threshold
const MAX_SUGGESTIONS = 2              // Max results to show
```

### Adding BM25 Full-Text Search

Run in Supabase SQL Editor:
```sql
-- See scripts/add-fts-search.sql for full migration
ALTER TABLE song_images ADD COLUMN search_vector tsvector;
CREATE INDEX idx_song_fts ON song_images USING gin(search_vector);
```

---

## Bug Fixes & Learnings

### Bug 1: Empty String Match (JavaScript Gotcha)

**Problem:** All songs with `null` Korean title matched EVERY query!

```javascript
// In JavaScript:
"anyQuery".includes('')  // Always returns TRUE!

// Our buggy code:
const koreanNorm = normalizeKorean(song.song_title_korean || '')  // '' if null
return query.includes(koreanNorm)  // "query".includes('') = true!
```

**Fix:** Check string length before `includes()`:
```typescript
const titleInQuery = (koreanNorm.length > 0 && query.includes(koreanNorm))
```

### Bug 2: Key Detection False Positive

**Problem:** "only king" was detected as a key query with key "IN"!

```
Query: "only king"

Regex: /(in\s*)([A-G])/i
Match: "k-IN-g" → captures "in" + "g"

Result: key = match[1] = "IN" (uppercase of "in")
        System searched for songs in key "IN" instead of title "Only King"
```

**Fix:** Add word boundaries and explicit key group selection:
```typescript
// Before (buggy):
/(in\s*)([A-Ga-g][#b]?m?)/i
const key = match[1] || match[2]  // Takes "in" not "g"!

// After (fixed):
/\bkey\s+of\s+([A-Ga-g][#b]?m?)\b/i  // Require "key of"
{ pattern: /.../, keyGroup: 1 }       // Explicit group
```

### Bug 3: Vector Search Empty Embedding Error

**Problem:** When Voyage API rate-limited, empty embedding `[]` caused Supabase error.

```
Error: vector must have at least 1 dimension
```

**Fix:** Guard against empty embeddings:
```typescript
if (!queryEmbedding || queryEmbedding.length === 0) {
  console.log('[Vector Search] Skipped - no embedding')
  return []
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm build` to verify
5. Submit a pull request

---

## License

MIT License - See LICENSE file for details.

---

## Acknowledgments

- Built with [Claude Code](https://claude.ai/claude-code)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Vector search powered by [Voyage AI](https://www.voyageai.com)
- Database hosted on [Supabase](https://supabase.com)
