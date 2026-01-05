# PraiseFlow Comprehensive Test Plan

## Application Overview

PraiseFlow is a bilingual (Korean/English) AI-powered search system for finding worship song chord sheets. The application uses a hybrid search approach with 7 parallel search methods (exact match, BM25, normalized Korean, aliases, fuzzy, vector, OCR) combined with Reciprocal Rank Fusion (RRF) for optimal results. Users can search by song title in Korean or English, filter by musical key, and specify the number of results. The system handles Korean text variations, cross-language search, typo tolerance, multi-page sheet grouping, and provides an interactive chat-like interface with image cards and full-screen modal viewers.

## Test Scenarios

### 1. Initial Page Load and UI Elements

**Seed:** `e2e/seed.spec.ts`

#### 1.1. Verify main UI elements are visible

**File:** `e2e/initial-load/main-ui-elements.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Verify the header is visible
  3. Verify the app title '찬양팀 악보' is displayed
  4. Verify the subtitle 'WORSHIP SONG FINDER' is visible
  5. Verify the settings button (gear icon) is visible in the header
  6. Verify the welcome message '안녕하세요!' is displayed
  7. Verify the search input with placeholder '곡 제목을 입력하세요...' is visible
  8. Verify the send button is visible next to the search input

**Expected Results:**
  - All main UI elements are visible and properly rendered
  - The page layout is clean and organized
  - Text is properly displayed in Korean

#### 1.2. Verify quick search suggestion buttons

**File:** `e2e/initial-load/quick-search-buttons.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Verify the quick search button '오 베들레헴' is visible
  3. Verify the quick search button 'G키 찬양 5개' is visible
  4. Verify the quick search button '거룩하신 어린양' is visible
  5. Verify the quick search button 'D키 악보 3개' is visible
  6. Verify all buttons have icons displayed
  7. Verify buttons are properly styled and aligned

**Expected Results:**
  - All four quick search buttons are visible
  - Buttons display both icon and text
  - Buttons are horizontally arranged and responsive

#### 1.3. Verify page is not scrollable on initial load

**File:** `e2e/initial-load/no-scroll-initial-state.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Check the document's scrollHeight vs clientHeight
  3. Verify there is no vertical overflow
  4. Check for horizontal overflow
  5. Verify the page fits within the viewport

**Expected Results:**
  - The page does not have vertical scroll on initial load
  - The page does not have horizontal scroll
  - All content fits within the viewport

#### 1.4. Verify responsive design on desktop

**File:** `e2e/initial-load/desktop-responsive.spec.ts`

**Steps:**
  1. Set viewport to desktop size (1920x1080)
  2. Navigate to the application homepage
  3. Verify the layout uses appropriate spacing
  4. Verify the search container is centered
  5. Verify quick search buttons are horizontally arranged
  6. Check that text is readable and properly sized

**Expected Results:**
  - Layout is optimized for desktop viewing
  - Content is properly centered with adequate margins
  - All elements are clearly visible and accessible

### 2. Search Functionality - Korean Input

**Seed:** `e2e/seed.spec.ts`

#### 2.1. Search by Korean song title

**File:** `e2e/search-korean/basic-korean-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type '베들레헴' in the search input
  3. Press Enter to submit the search
  4. Wait for the loading spinner to disappear
  5. Verify the user message '베들레헴' appears in the chat
  6. Verify an assistant response is displayed
  7. Verify the word '악보' appears in the response
  8. Verify image cards are displayed with song results

**Expected Results:**
  - Search query is submitted successfully
  - Loading state is shown during search
  - Results are displayed with relevant song sheets
  - Image cards show chord sheet thumbnails

#### 2.2. Search for specific Korean song

**File:** `e2e/search-korean/specific-song-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type '거룩하신 어린양' in the search input
  3. Press Enter to submit
  4. Wait for loading to complete
  5. Verify the exact song title '거룩하신 어린양' appears in results
  6. Verify image cards are displayed
  7. Check that the key badge is visible on the card

**Expected Results:**
  - The exact song is found and displayed
  - Song information includes title and key
  - Results are relevant to the search query

#### 2.3. Search with Korean text variations (spacing)

**File:** `e2e/search-korean/korean-spacing-variations.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Search for '위대하신주' (no spaces)
  3. Wait for results and note the songs found
  4. Clear the search
  5. Search for '위대하신 주' (with space)
  6. Wait for results
  7. Verify the same song is found in both searches

**Expected Results:**
  - Korean normalization works correctly
  - Songs are found regardless of spacing variations
  - Results are consistent between spaced and non-spaced queries

#### 2.4. Korean IME input composition handling

**File:** `e2e/search-korean/korean-ime-composition.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type Korean text '베들레헴' character by character with delay
  3. Press Enter to submit
  4. Wait for results
  5. Count the number of user messages in the chat
  6. Verify only ONE user message appears (not multiple partial messages)

**Expected Results:**
  - Korean IME composition is handled correctly
  - Only the final composed text is submitted
  - No partial character submissions occur during typing
  - Chat shows exactly one user message for the search

#### 2.5. Search with typo tolerance

**File:** `e2e/search-korean/typo-tolerance.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type '위대하신쥬' (typo: 쥬 instead of 주) in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify that results for '위대하신주' are shown
  6. Verify fuzzy matching found the correct song despite the typo

**Expected Results:**
  - Fuzzy search handles typos effectively
  - The correct song is found despite minor spelling errors
  - Results are relevant even with typo in query

### 3. Search Functionality - English Input

**Seed:** `e2e/seed.spec.ts`

#### 3.1. Search by English song title

**File:** `e2e/search-english/basic-english-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'Holy Forever' in the search input
  3. Press Enter to submit
  4. Wait for loading to complete
  5. Verify the user message 'Holy Forever' appears
  6. Verify assistant response is displayed
  7. Verify image cards show the song results
  8. Check for the song title in the response or cards

**Expected Results:**
  - English search query works correctly
  - Song 'Holy Forever' is found
  - Results display chord sheet images
  - Cross-language alias matching works (English → Korean)

#### 3.2. Search for English song with Korean results

**File:** `e2e/search-english/english-to-korean-alias.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'Great Are You Lord' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify results are displayed
  6. Check if the Korean title equivalent is shown
  7. Verify the alias matching worked

**Expected Results:**
  - English title finds Korean chord sheets
  - Alias table lookup works correctly
  - Results show the corresponding Korean song

#### 3.3. Partial English title search

**File:** `e2e/search-english/partial-title-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'Holy' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify songs containing 'Holy' in the title are shown
  6. Check that partial match works with ILIKE search

**Expected Results:**
  - Partial title matching works
  - Multiple songs with 'Holy' in title may be shown
  - Exact match search method finds relevant results

### 4. Key-Based Filtering

**Seed:** `e2e/seed.spec.ts`

#### 4.1. Search for songs by musical key with count

**File:** `e2e/key-filtering/key-with-count.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'D키 악보 3개' in the search input
  3. Press Enter to submit
  4. Wait for loading to complete
  5. Verify the assistant response mentions '3곡'
  6. Count the number of unique song cards displayed
  7. Verify each card shows 'D' key badge
  8. Verify exactly 3 unique songs are shown (not 3 pages)

**Expected Results:**
  - Key-based filtering works correctly
  - Count parameter is respected (3 songs requested)
  - Multi-page songs are counted as 1 song
  - All results are in the requested key (D)

#### 4.2. Search for G key songs with higher count

**File:** `e2e/key-filtering/g-key-five-songs.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'G키 찬양 5개' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify the response mentions 'G 키' or 'G키'
  6. Verify up to 5 unique songs are displayed
  7. Check that each card has a 'G' key badge

**Expected Results:**
  - G key filtering works correctly
  - Up to 5 songs are returned
  - All displayed songs are in G key
  - Results respect the requested count

#### 4.3. Search for multi-key songs (D and B keys)

**File:** `e2e/key-filtering/multi-key-song-d.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'D키 악보' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Look for the song '저 들 밖에 한밤중에' in the results
  6. Verify the song appears (it has both D and B key versions)
  7. Check that the key badge shows the available keys

**Expected Results:**
  - Songs with multiple keys are found when searching for one key
  - The song '저 들 밖에 한밤중에' appears in D key search
  - Multi-key badge or indicator is shown on the card

#### 4.4. Verify multi-key song appears in B key search

**File:** `e2e/key-filtering/multi-key-song-b.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'B키 악보' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify the song '저 들 밖에 한밤중에' appears
  6. Confirm the song appears in both D key and B key searches

**Expected Results:**
  - The same multi-key song appears when searching for different keys
  - Song is correctly indexed with multiple keys
  - Key filtering includes all versions of a song

#### 4.5. Key detection does not false positive on words containing key patterns

**File:** `e2e/key-filtering/no-false-positive-key-detection.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Type 'only king' in the search input
  3. Press Enter to submit
  4. Wait for results
  5. Verify the search does NOT interpret 'IN' from 'kINg' as a key
  6. Verify results are based on title search, not key filtering
  7. Check that proper word boundary detection works

**Expected Results:**
  - Key detection does not trigger on words like 'king' or 'sing'
  - Search treats 'only king' as a title search
  - No false key extraction from partial word matches

### 5. Multi-Page Song Handling

**Seed:** `e2e/seed.spec.ts`

#### 5.1. Multi-page song displays as single card with page count

**File:** `e2e/multi-page/single-card-page-count.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Search for 'Holy Forever'
  3. Wait for results
  4. Count the number of cards for 'Holy Forever'
  5. Verify only 1 card is shown (not separate cards for each page)
  6. Look for a page indicator badge (e.g., '3p' for 3 pages)
  7. Verify the page count badge is visible on the card

**Expected Results:**
  - Multi-page songs are grouped into a single card
  - Page count indicator shows the total number of pages
  - Deduplication works correctly for multi-page sheets

#### 5.2. Song count in key search excludes duplicate pages

**File:** `e2e/multi-page/key-search-deduplication.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Search for 'D키 악보 5개'
  3. Wait for results
  4. Extract the song titles from the response text
  5. Count the unique song titles
  6. Verify no duplicate song titles appear in the list
  7. Verify multi-page songs are counted as 1, not multiple

**Expected Results:**
  - Song count refers to unique songs, not total pages
  - If a song has 3 pages, it counts as 1 song in the results
  - No duplicate songs appear in the numbered list
  - Deduplication algorithm works correctly

#### 5.3. Multi-page songs grouped by filename and title

**File:** `e2e/multi-page/filename-grouping.spec.ts`

**Steps:**
  1. Search for a known multi-page song
  2. Wait for results
  3. Verify pages are grouped together
  4. Check that grouping uses both filename pattern and song title
  5. Verify songs with similar names but different titles are not incorrectly grouped

**Expected Results:**
  - Pages with same base filename and song title are grouped
  - Different songs are not incorrectly merged
  - Grouping logic prevents false positives

### 6. Quick Search Buttons

**Seed:** `e2e/seed.spec.ts`

#### 6.1. Click quick search button triggers search

**File:** `e2e/quick-search/button-triggers-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Click the '오 베들레헴' quick search button
  3. Verify a loading spinner appears
  4. Wait for loading to complete
  5. Verify search results are displayed
  6. Verify the word '악보' appears in the response
  7. Verify image cards are shown

**Expected Results:**
  - Quick search button click initiates a search
  - Loading state is shown
  - Results are displayed for '오 베들레헴'
  - Functionality is identical to typing and submitting

#### 6.2. Key-based quick search button works

**File:** `e2e/quick-search/key-based-quick-search.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Click the 'G키 찬양 5개' quick search button
  3. Wait for loading to complete
  4. Verify results mention 'G 키' or 'G키'
  5. Verify up to 5 songs are displayed
  6. Check that all cards have 'G' key badges

**Expected Results:**
  - Key-based quick search works correctly
  - Results are filtered by G key
  - Count parameter (5) is respected

#### 6.3. Multiple quick searches in sequence

**File:** `e2e/quick-search/sequential-quick-searches.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Click '오 베들레헴' button and wait for results
  3. Verify results are displayed
  4. Click 'D키 악보 3개' button
  5. Wait for new results
  6. Verify the chat shows both searches
  7. Verify the latest results are for D key songs

**Expected Results:**
  - Multiple quick searches can be performed sequentially
  - Each search adds to the chat history
  - Previous results remain visible in the chat
  - Latest results are shown at the bottom

### 7. Image Modal Viewer

**Seed:** `e2e/seed.spec.ts`

#### 7.1. Click image card opens full-screen modal

**File:** `e2e/modal/open-modal.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Search for 'Holy Forever'
  3. Wait for results to appear
  4. Click on the first image card
  5. Verify the modal dialog opens
  6. Verify the image is displayed in full-screen
  7. Check for download button visibility
  8. Check for share button visibility
  9. Verify close button (X) is visible

**Expected Results:**
  - Modal opens when image card is clicked
  - Full-screen modal displays the chord sheet image
  - Download and share buttons are visible
  - Close button is accessible

#### 7.2. Navigate multi-page song in modal

**File:** `e2e/modal/multi-page-navigation.spec.ts`

**Steps:**
  1. Search for a multi-page song (e.g., 'Holy Forever')
  2. Wait for results
  3. Click on the image card to open modal
  4. Verify page indicator dots are visible (if multi-page)
  5. Click the right arrow to go to next page
  6. Verify the image changes to page 2
  7. Click the left arrow to go back to page 1
  8. Verify the image returns to page 1
  9. Check the page indicator updates correctly

**Expected Results:**
  - Multi-page navigation works with arrow buttons
  - Page indicator shows current page and total pages
  - Left/right arrows navigate between pages correctly
  - Images load properly when navigating

#### 7.3. Download single page from modal

**File:** `e2e/modal/download-single-page.spec.ts`

**Steps:**
  1. Search for any song
  2. Wait for results
  3. Click on an image card to open modal
  4. Click the download button
  5. Verify download is triggered
  6. Check that the filename is appropriate

**Expected Results:**
  - Download button triggers image download
  - Single page is downloaded with correct filename
  - Download completes successfully

#### 7.4. Download all pages option for multi-page songs

**File:** `e2e/modal/download-all-pages.spec.ts`

**Steps:**
  1. Search for a multi-page song
  2. Open the modal
  3. Look for 'Download All' or similar button (if available)
  4. Click to download all pages
  5. Verify multiple downloads are initiated or a zip file is downloaded

**Expected Results:**
  - Multi-page songs offer option to download all pages
  - All pages are downloaded correctly
  - Downloads are organized properly

#### 7.5. Share functionality in modal

**File:** `e2e/modal/share-button.spec.ts`

**Steps:**
  1. Search for any song
  2. Open the modal
  3. Click the share button
  4. Verify share dialog or functionality is triggered
  5. Check if native share API is invoked or custom share options appear

**Expected Results:**
  - Share button is functional
  - Share mechanism is triggered (Web Share API or custom)
  - User can share the chord sheet

#### 7.6. Close modal with X button

**File:** `e2e/modal/close-x-button.spec.ts`

**Steps:**
  1. Search for any song
  2. Open the modal
  3. Click the X (close) button
  4. Verify the modal closes
  5. Verify the user is back to the chat view

**Expected Results:**
  - X button closes the modal
  - Modal closes smoothly without errors
  - User returns to the previous view

#### 7.7. Close modal by clicking outside

**File:** `e2e/modal/close-click-outside.spec.ts`

**Steps:**
  1. Search for any song
  2. Open the modal
  3. Click outside the modal content area (on the backdrop)
  4. Verify the modal closes
  5. Verify the user is back to the chat view

**Expected Results:**
  - Clicking outside the modal closes it
  - Modal handles backdrop clicks correctly
  - User experience is intuitive

#### 7.8. Close modal with Escape key

**File:** `e2e/modal/close-escape-key.spec.ts`

**Steps:**
  1. Search for any song
  2. Open the modal
  3. Press the Escape key
  4. Verify the modal closes
  5. Verify the user is back to the chat view

**Expected Results:**
  - Escape key closes the modal
  - Keyboard accessibility is implemented
  - Modal closes cleanly

### 8. Settings and Preferences

**Seed:** `e2e/seed.spec.ts`

#### 8.1. Open settings dialog

**File:** `e2e/settings/open-settings.spec.ts`

**Steps:**
  1. Navigate to the application homepage
  2. Click the settings button (gear icon) in the header
  3. Verify the settings dialog opens
  4. Verify the dialog title '설정' is displayed
  5. Verify language toggle option is visible
  6. Verify theme toggle option is visible

**Expected Results:**
  - Settings dialog opens when gear icon is clicked
  - Dialog displays language and theme options
  - UI is clear and organized

#### 8.2. Toggle language from Korean to English

**File:** `e2e/settings/language-toggle-to-english.spec.ts`

**Steps:**
  1. Navigate to the application (default: Korean)
  2. Open settings dialog
  3. Verify current language shows '한국어'
  4. Click the 'English' button
  5. Close the settings dialog
  6. Verify the UI text changes to English
  7. Verify search placeholder becomes 'Enter song title' or similar
  8. Verify app title remains or changes appropriately

**Expected Results:**
  - Language toggle changes UI from Korean to English
  - All interface text updates to English
  - Preference is applied immediately
  - Setting is persisted to localStorage

#### 8.3. Toggle language from English to Korean

**File:** `e2e/settings/language-toggle-to-korean.spec.ts`

**Steps:**
  1. Set language to English first
  2. Open settings dialog
  3. Click the Korean language button
  4. Close settings
  5. Verify UI text changes to Korean
  6. Verify placeholder becomes '곡 제목을 입력하세요'
  7. Verify all UI elements display in Korean

**Expected Results:**
  - Language toggle changes UI from English to Korean
  - All interface text updates to Korean
  - Toggle works bidirectionally

#### 8.4. Toggle theme from dark to light

**File:** `e2e/settings/theme-toggle-to-light.spec.ts`

**Steps:**
  1. Navigate to the application (default: dark mode)
  2. Capture the initial background color
  3. Open settings dialog
  4. Verify current theme shows '다크 모드'
  5. Click the '밝게' (Light) button
  6. Close settings
  7. Capture the new background color
  8. Verify the background color has changed to light
  9. Verify text colors have adjusted for light mode

**Expected Results:**
  - Theme toggle switches from dark to light mode
  - Background changes to light color
  - Text and UI elements adjust for readability
  - Theme preference is saved to localStorage

#### 8.5. Toggle theme from light to dark

**File:** `e2e/settings/theme-toggle-to-dark.spec.ts`

**Steps:**
  1. Set theme to light mode first
  2. Open settings dialog
  3. Click the dark mode button
  4. Close settings
  5. Verify background changes to dark
  6. Verify UI elements are styled for dark mode

**Expected Results:**
  - Theme toggle switches from light to dark mode
  - Background changes to dark color
  - All elements are visible and readable in dark mode

#### 8.6. Settings persist after page reload

**File:** `e2e/settings/settings-persistence.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Open settings and change language to English
  3. Open settings and change theme to light mode
  4. Close settings
  5. Reload the page
  6. Verify language is still English after reload
  7. Verify theme is still light mode after reload

**Expected Results:**
  - Language preference persists after page reload
  - Theme preference persists after page reload
  - localStorage correctly stores and retrieves settings

#### 8.7. Close settings dialog

**File:** `e2e/settings/close-settings.spec.ts`

**Steps:**
  1. Open settings dialog
  2. Click the 'Close' button
  3. Verify the dialog closes
  4. Open settings again
  5. Press Escape key
  6. Verify the dialog closes

**Expected Results:**
  - Settings dialog can be closed with Close button
  - Settings dialog can be closed with Escape key
  - Dialog closes smoothly

### 9. Loading States and Progress Indicators

**Seed:** `e2e/seed.spec.ts`

#### 9.1. Progressive loading messages display

**File:** `e2e/loading/progressive-loading-messages.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Type a search query
  3. Submit the search
  4. Immediately check for loading spinner visibility
  5. Look for progressive loading messages (e.g., '찾는 중...', 'AI가 최적의 결과를 분석 중...', '결과를 정리하는 중...')
  6. Verify loading progress bar is visible
  7. Wait for loading to complete
  8. Verify loading indicators disappear when results are ready

**Expected Results:**
  - Loading spinner appears immediately after search submission
  - Progressive loading messages show the search stages
  - Progress bar animates during search
  - Loading indicators disappear when search completes
  - 5-phase loading system works correctly

#### 9.2. User message appears before loading completes

**File:** `e2e/loading/user-message-instant.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Type '테스트' in the search input
  3. Press Enter
  4. Immediately check if user message '테스트' appears
  5. Verify user message is visible within 1 second
  6. Verify loading indicator appears after user message

**Expected Results:**
  - User message appears instantly upon submission
  - User doesn't have to wait for search to complete to see their message
  - Chat UX is responsive and immediate

#### 9.3. Input is disabled during search

**File:** `e2e/loading/input-disabled-during-search.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Submit a search query
  3. While loading, check if the search input is disabled
  4. Try to type in the input field during loading
  5. Verify the send button is also disabled
  6. Wait for search to complete
  7. Verify input and button are re-enabled after loading

**Expected Results:**
  - Search input is disabled during search
  - Send button is disabled during search
  - User cannot submit multiple queries simultaneously
  - Controls are re-enabled after search completes

#### 9.4. Loading animation is smooth and visible

**File:** `e2e/loading/loading-animation.spec.ts`

**Steps:**
  1. Submit a search
  2. Verify the spinner has animation class (e.g., 'animate-spin')
  3. Verify the progress bar has gradient animation
  4. Check that animations are smooth
  5. Verify no flickering or visual glitches

**Expected Results:**
  - Loading animations are smooth
  - Spinner rotates continuously
  - Progress bar animates correctly
  - Visual feedback is clear to users

### 10. Error Handling and Edge Cases

**Seed:** `e2e/seed.spec.ts`

#### 10.1. Empty search query handling

**File:** `e2e/errors/empty-search-query.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Leave the search input empty
  3. Press Enter or click send button
  4. Verify no search is triggered
  5. Verify input validation prevents empty submission
  6. Verify no loading state appears

**Expected Results:**
  - Empty queries are not submitted
  - Input validation prevents unnecessary API calls
  - User experience handles empty input gracefully

#### 10.2. No results found scenario

**File:** `e2e/errors/no-results-found.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Search for a non-existent song (e.g., 'xyznonexistentsong123')
  3. Wait for search to complete
  4. Verify a message indicating no results is displayed
  5. Verify the message is helpful (e.g., suggests trying different keywords)
  6. Verify no image cards are displayed

**Expected Results:**
  - No results scenario is handled gracefully
  - User receives helpful feedback message
  - Claude AI may provide assistance when no results found
  - No errors or crashes occur

#### 10.3. Network error graceful degradation

**File:** `e2e/errors/network-error.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Simulate network offline condition or API failure
  3. Submit a search query
  4. Verify error message is displayed to user
  5. Verify the app does not crash
  6. Verify user can retry after network is restored

**Expected Results:**
  - Network errors are caught and handled
  - User receives informative error message
  - Application remains functional after error
  - Retry mechanism is available

#### 10.4. Very long search query handling

**File:** `e2e/errors/long-search-query.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Type a very long search query (200+ characters)
  3. Submit the query
  4. Verify the app handles it without breaking
  5. Verify search executes or provides appropriate feedback

**Expected Results:**
  - Long queries don't break the UI
  - Input field handles long text
  - Backend processes or rejects query appropriately

#### 10.5. Special characters in search query

**File:** `e2e/errors/special-characters.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Search with special characters (e.g., '#', '&', '@', '!')
  3. Submit the query
  4. Verify the app handles special characters without errors
  5. Verify search executes or provides results if available

**Expected Results:**
  - Special characters don't cause errors
  - Input sanitization works correctly
  - Search handles various character types

### 11. Responsive Design - Mobile

**Seed:** `e2e/seed.spec.ts`

#### 11.1. Mobile viewport - no horizontal scroll

**File:** `e2e/responsive/mobile-no-horizontal-scroll.spec.ts`

**Steps:**
  1. Set viewport to iPhone SE size (375x667)
  2. Navigate to the application
  3. Check document scrollWidth vs clientWidth
  4. Verify no horizontal overflow
  5. Scroll through the page content
  6. Verify all content is visible without horizontal scrolling

**Expected Results:**
  - No horizontal scroll on mobile devices
  - All content fits within mobile viewport width
  - Layout is mobile-optimized

#### 11.2. Touch-friendly button sizes on mobile

**File:** `e2e/responsive/mobile-touch-targets.spec.ts`

**Steps:**
  1. Set viewport to mobile size (375x667)
  2. Navigate to the application
  3. Measure the quick search buttons dimensions
  4. Verify each button is at least 40-44px in height
  5. Verify buttons have adequate spacing between them
  6. Test tapping each button

**Expected Results:**
  - All buttons meet minimum touch target size (44px recommended by Apple)
  - Buttons are easy to tap without mis-clicks
  - Spacing prevents accidental taps on adjacent buttons

#### 11.3. Mobile search input usability

**File:** `e2e/responsive/mobile-search-input.spec.ts`

**Steps:**
  1. Set viewport to mobile size
  2. Navigate to the application
  3. Tap on the search input
  4. Verify the input receives focus
  5. Verify mobile keyboard appears (if testable)
  6. Type a query
  7. Verify text is readable and properly sized

**Expected Results:**
  - Search input is easily accessible on mobile
  - Input field is appropriately sized for mobile
  - Text is readable on small screens

#### 11.4. Mobile modal viewer

**File:** `e2e/responsive/mobile-modal.spec.ts`

**Steps:**
  1. Set viewport to mobile size
  2. Search for a song and open the modal
  3. Verify modal takes full screen on mobile
  4. Verify image is properly sized and visible
  5. Verify navigation arrows are touch-friendly
  6. Test closing the modal on mobile

**Expected Results:**
  - Modal is optimized for mobile viewing
  - Images display properly on small screens
  - Touch controls work smoothly
  - Modal can be easily closed on mobile

#### 11.5. Mobile chat message display

**File:** `e2e/responsive/mobile-chat-messages.spec.ts`

**Steps:**
  1. Set viewport to mobile size
  2. Perform a search
  3. Verify user and assistant messages display correctly
  4. Check that text wraps appropriately
  5. Verify image cards are responsive on mobile
  6. Scroll through chat messages

**Expected Results:**
  - Chat messages are readable on mobile
  - Text wraps properly without overflow
  - Image cards adapt to mobile width
  - Scrolling is smooth

### 12. Responsive Design - Tablet

**Seed:** `e2e/seed.spec.ts`

#### 12.1. Tablet viewport layout

**File:** `e2e/responsive/tablet-layout.spec.ts`

**Steps:**
  1. Set viewport to iPad size (768x1024)
  2. Navigate to the application
  3. Verify layout adapts to tablet width
  4. Check that quick search buttons are appropriately sized
  5. Verify no horizontal scroll
  6. Test both portrait and landscape orientations

**Expected Results:**
  - Layout is optimized for tablet screens
  - Content uses available space effectively
  - Both orientations are supported
  - UI elements are appropriately sized

#### 12.2. Tablet search results display

**File:** `e2e/responsive/tablet-search-results.spec.ts`

**Steps:**
  1. Set viewport to tablet size
  2. Perform a search
  3. Verify image cards display well on tablet
  4. Check that multiple cards can fit horizontally if designed
  5. Verify chat messages are readable

**Expected Results:**
  - Search results are well-presented on tablets
  - Image cards utilize tablet screen space
  - Layout is clean and organized

### 13. Accessibility

**Seed:** `e2e/seed.spec.ts`

#### 13.1. Keyboard navigation

**File:** `e2e/accessibility/keyboard-navigation.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Use Tab key to navigate through interactive elements
  3. Verify focus moves through: search input, send button, quick search buttons, settings button
  4. Verify focus indicators are visible
  5. Use Enter key to activate focused buttons
  6. Use Escape key to close dialogs

**Expected Results:**
  - All interactive elements are keyboard accessible
  - Tab order is logical and intuitive
  - Focus indicators are clearly visible
  - Enter and Escape keys work as expected

#### 13.2. Screen reader compatibility

**File:** `e2e/accessibility/screen-reader-labels.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Check that all buttons have accessible labels
  3. Verify images have alt text
  4. Check that input has proper label or placeholder
  5. Verify modal dialogs have aria-labels
  6. Check for proper heading hierarchy

**Expected Results:**
  - All UI elements have appropriate ARIA labels
  - Images have descriptive alt text
  - Content is structured for screen readers
  - Semantic HTML is used correctly

#### 13.3. Color contrast

**File:** `e2e/accessibility/color-contrast.spec.ts`

**Steps:**
  1. Navigate to the application in light mode
  2. Verify text has sufficient contrast with background
  3. Switch to dark mode
  4. Verify text contrast in dark mode
  5. Check button text visibility
  6. Verify link and interactive element visibility

**Expected Results:**
  - Color contrast meets WCAG AA standards (4.5:1 for normal text)
  - Both light and dark themes have good contrast
  - Text is readable in all color schemes

### 14. Performance and Optimization

**Seed:** `e2e/seed.spec.ts`

#### 14.1. Search response time

**File:** `e2e/performance/search-response-time.spec.ts`

**Steps:**
  1. Navigate to the application
  2. Record timestamp before submitting search
  3. Submit a search query
  4. Wait for results to appear
  5. Record timestamp when results are visible
  6. Calculate total response time
  7. Verify response time is under 30 seconds

**Expected Results:**
  - Search completes within acceptable time (< 30 seconds)
  - Loading indicators show progress
  - User is kept informed during wait time

#### 14.2. Image loading performance

**File:** `e2e/performance/image-loading.spec.ts`

**Steps:**
  1. Search for a song with images
  2. Observe image loading behavior
  3. Verify images load progressively or with placeholders
  4. Check that images are optimized (not excessively large)
  5. Verify lazy loading if implemented

**Expected Results:**
  - Images load efficiently
  - Placeholders or loading states are shown
  - Page remains responsive during image loading
  - Images are appropriately compressed

#### 14.3. Multiple searches don't degrade performance

**File:** `e2e/performance/multiple-searches.spec.ts`

**Steps:**
  1. Perform 5 consecutive searches
  2. Verify each search completes successfully
  3. Check that response times don't significantly increase
  4. Verify memory usage doesn't balloon
  5. Check for any console errors or warnings

**Expected Results:**
  - Application handles multiple searches smoothly
  - Performance remains consistent
  - No memory leaks or accumulating errors
  - Chat history grows appropriately

### 15. Hybrid Search Methods Validation

**Seed:** `e2e/seed.spec.ts`

#### 15.1. Exact match search (ILIKE)

**File:** `e2e/search-methods/exact-match.spec.ts`

**Steps:**
  1. Search for an exact song title
  2. Verify the exact song is returned as the top result
  3. Check that partial matches also work
  4. Verify case-insensitive matching

**Expected Results:**
  - Exact title matches are found
  - Case insensitivity works
  - Partial substring matching works

#### 15.2. BM25 full-text search

**File:** `e2e/search-methods/bm25-fts.spec.ts`

**Steps:**
  1. Search with multiple keywords (e.g., 'holy forever worship')
  2. Verify results are ranked by relevance
  3. Check that word order flexibility works
  4. Verify BM25 ranking provides relevant results

**Expected Results:**
  - Full-text search handles multi-word queries
  - Results are relevance-ranked
  - Word order variations are handled

#### 15.3. Normalized Korean matching

**File:** `e2e/search-methods/normalized-korean.spec.ts`

**Steps:**
  1. Search for Korean text with spaces: '위대하신 주'
  2. Note the results
  3. Search for the same text without spaces: '위대하신주'
  4. Verify the same song is found in both searches
  5. Test with various spacing patterns

**Expected Results:**
  - Korean normalization removes spaces before matching
  - Spaced and non-spaced queries return same results
  - NFC Unicode normalization works correctly

#### 15.4. Cross-language alias lookup

**File:** `e2e/search-methods/alias-lookup.spec.ts`

**Steps:**
  1. Search for an English title that has a Korean equivalent
  2. Verify the Korean chord sheet is found
  3. Search for a Korean title with English alias
  4. Verify the English version is found (if available)
  5. Test romanized Korean aliases

**Expected Results:**
  - Alias table enables cross-language search
  - English queries find Korean songs
  - Korean queries find English songs
  - Romanized aliases work

#### 15.5. Fuzzy matching (Levenshtein)

**File:** `e2e/search-methods/fuzzy-matching.spec.ts`

**Steps:**
  1. Search with intentional typo
  2. Verify similar songs are still found
  3. Check that similarity threshold is reasonable
  4. Test various typo scenarios

**Expected Results:**
  - Fuzzy matching handles typos
  - Results are scored by similarity
  - Threshold prevents too-distant matches

#### 15.6. Vector semantic search

**File:** `e2e/search-methods/vector-semantic.spec.ts`

**Steps:**
  1. Search with a descriptive phrase (e.g., 'praise song about glory')
  2. Verify semantically similar songs are found even without exact keywords
  3. Check that vector search provides relevant results
  4. Test with various semantic queries

**Expected Results:**
  - Vector search finds semantically similar content
  - Voyage AI embeddings enable meaning-based search
  - Results are relevant even without keyword matches

#### 15.7. OCR text search

**File:** `e2e/search-methods/ocr-text-search.spec.ts`

**Steps:**
  1. Search for a phrase from the lyrics or content of a chord sheet
  2. Verify the song is found via OCR text match
  3. Check that OCR search complements title search

**Expected Results:**
  - OCR text is searchable
  - Songs can be found by lyric content
  - OCR search method contributes to results

#### 15.8. RRF score fusion

**File:** `e2e/search-methods/rrf-fusion.spec.ts`

**Steps:**
  1. Search for a term that matches via multiple methods
  2. Verify the song appears in results
  3. Check that songs matched by multiple methods rank higher
  4. Verify RRF combines results from all 7 methods

**Expected Results:**
  - RRF combines results from all search methods
  - Songs matched by multiple methods are boosted
  - Final ranking is balanced and relevant
