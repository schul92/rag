// Internationalization - Korean (default) and English

export type Language = 'ko' | 'en'

export interface Translations {
  appTitle: string
  appSubtitle: string
  settings: string
  theme: string
  darkMode: string
  lightMode: string
  dark: string
  light: string
  language: string
  korean: string
  english: string
  welcomeMessage: string
  errorMessage: string
  searching: string
  quickSearch: string
  inputPlaceholder: string
  inputHint: string
  inputSubHint: string
  examplesTitle: string
  examples: string[]
  keySelection: string
  me: string
  pages: string
  viewLarger: string
  download: string
  fromWeb: string
  key: string
  foundSheet: (title: string, key?: string) => string
  foundSheets: (title: string, count: number, keys?: string) => string
  noResults: string
  webResults: string
  selectKey: (title: string, keys: string) => string
  keyListResult: (key: string, count: number) => string
  // Progressive loading messages
  loadingPhase1: string
  loadingPhase2: (query: string) => string
  loadingPhase3: string
  loadingPhase4: string
  loadingPhase5: string
}

export const translations: Record<Language, Translations> = {
  ko: {
    // Header
    appTitle: '찬양팀 악보',
    appSubtitle: 'WORSHIP SONG FINDER',

    // Settings
    settings: '설정',
    theme: '테마',
    darkMode: '다크 모드',
    lightMode: '라이트 모드',
    dark: '어둡게',
    light: '밝게',
    language: '언어',
    korean: '한국어',
    english: 'English',

    // Chat
    welcomeMessage: '찬양 악보를 찾아드릴게요',
    errorMessage: '죄송합니다, 오류가 발생했습니다. 다시 시도해주세요.',
    searching: '검색 중...',
    quickSearch: '빠른 검색',
    inputPlaceholder: '검색어 입력...',
    inputHint: '곡 제목, 기억나는 가사, 또는 키로 검색하세요',
    inputSubHint: '기본 2곡 · 더 원하면 "5개" 처럼 숫자 추가',
    examplesTitle: '검색 예시 보기',
    examples: [
      '곡 제목 → "나는 믿네", "Holy Forever"',
      '가사 일부 → "주님의 사랑이", "나 같은 죄인"',
      '키 검색 → "G키 5개", "A키 찬양"',
    ],
    keySelection: '키 선택:',
    me: '나',

    // Image card
    pages: '페이지',
    viewLarger: '크게 보기',
    download: '다운로드',
    fromWeb: '웹 검색 결과',
    key: '키',

    // Results
    foundSheet: (title: string, key?: string) =>
      key ? `'${title}' (${key}) 악보입니다.` : `'${title}' 악보를 찾았습니다.`,
    foundSheets: (title: string, count: number, keys?: string) =>
      keys ? `'${title}' 악보 ${count}개를 찾았습니다.\n🎵 키: ${keys}` : `'${title}' 악보 ${count}개를 찾았습니다.`,
    noResults: '검색 결과가 없습니다. 다른 키워드로 검색해 보세요.',
    webResults: 'DB에 없어서 웹에서 찾았습니다.',
    selectKey: (title: string, keys: string) =>
      `'${title}' 악보를 찾았습니다!\n🎹 사용 가능한 키: ${keys}\n\n어떤 키로 보시겠어요?`,
    keyListResult: (key: string, count: number) => `🎵 ${key} 키 악보 ${count}개`,

    // Progressive loading
    loadingPhase1: '검색 준비 중...',
    loadingPhase2: (query: string) => `'${query}' 찾는 중...`,
    loadingPhase3: '악보 데이터베이스 검색 중...',
    loadingPhase4: 'AI가 최적의 결과를 분석 중...',
    loadingPhase5: '결과를 정리하는 중...',
  },
  en: {
    // Header
    appTitle: 'Worship Sheets',
    appSubtitle: 'SONG FINDER',

    // Settings
    settings: 'Settings',
    theme: 'Theme',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    dark: 'Dark',
    light: 'Light',
    language: 'Language',
    korean: '한국어',
    english: 'English',

    // Chat
    welcomeMessage: 'Find worship chord sheets',
    errorMessage: 'Sorry, an error occurred. Please try again.',
    searching: 'Searching...',
    quickSearch: 'Quick Search',
    inputPlaceholder: 'Search...',
    inputHint: 'Search by song title, lyrics, or key',
    inputSubHint: 'Default: 2 songs · Add "5" for more',
    examplesTitle: 'See examples',
    examples: [
      'Song title → "Holy Forever", "나는 믿네"',
      'Partial lyrics → "Amazing grace", "주님의 사랑"',
      'By key → "G key songs", "A키 5개"',
    ],
    keySelection: 'Select key:',
    me: 'Me',

    // Image card
    pages: 'pages',
    viewLarger: 'View larger',
    download: 'Download',
    fromWeb: 'Web result',
    key: 'Key',

    // Results
    foundSheet: (title: string, key?: string) =>
      key ? `Found '${title}' (${key}).` : `Found '${title}'.`,
    foundSheets: (title: string, count: number, keys?: string) =>
      keys ? `Found ${count} sheets for '${title}'.\n🎵 Keys: ${keys}` : `Found ${count} sheets for '${title}'.`,
    noResults: 'No results found. Try different keywords.',
    webResults: 'Not in our DB. Found from web.',
    selectKey: (title: string, keys: string) =>
      `Found '${title}'!\n🎹 Available keys: ${keys}\n\nWhich key would you like?`,
    keyListResult: (key: string, count: number) => `🎵 ${count} sheets in key ${key}`,

    // Progressive loading
    loadingPhase1: 'Preparing search...',
    loadingPhase2: (query: string) => `Looking for '${query}'...`,
    loadingPhase3: 'Searching sheet music database...',
    loadingPhase4: 'AI analyzing best results...',
    loadingPhase5: 'Organizing results...',
  },
} as const

export function getTranslation(lang: Language) {
  return translations[lang]
}
