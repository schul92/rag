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
    welcomeMessage: '안녕하세요! 찬양팀 악보 검색 도우미입니다. 찾고 싶은 곡 제목을 입력해주세요.',
    errorMessage: '죄송합니다, 오류가 발생했습니다. 다시 시도해주세요.',
    searching: '검색 중...',
    quickSearch: '빠른 검색',
    inputPlaceholder: '곡 제목을 입력하세요...',
    inputHint: '곡 제목을 입력하면 악보를 찾아드립니다',
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
    welcomeMessage: 'Hello! I\'m your worship song sheet finder. Enter a song title to search.',
    errorMessage: 'Sorry, an error occurred. Please try again.',
    searching: 'Searching...',
    quickSearch: 'Quick Search',
    inputPlaceholder: 'Enter song title...',
    inputHint: 'Enter a song title to find chord sheets',
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
  },
} as const

export function getTranslation(lang: Language) {
  return translations[lang]
}
