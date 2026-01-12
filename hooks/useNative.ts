'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  isNative,
  isIOS,
  initializeNativeApp,
  hapticFeedback,
  hapticSuccess,
  nativeShare,
  cacheChordSheet,
  getCachedChordSheets,
  getCachedChordSheet,
  saveToLocal,
  getFromLocal,
} from '@/lib/native';

export interface CachedSheet {
  id: string;
  title: string;
  imageUrl: string;
  key?: string;
  cachedAt: number;
}

export function useNative() {
  const [initialized, setInitialized] = useState(false);
  const [recentSheets, setRecentSheets] = useState<CachedSheet[]>([]);

  // Initialize native app on mount
  useEffect(() => {
    if (isNative && !initialized) {
      initializeNativeApp().then(() => setInitialized(true));
    } else {
      setInitialized(true);
    }
  }, [initialized]);

  // Load recent/cached sheets
  useEffect(() => {
    loadRecentSheets();
  }, []);

  const loadRecentSheets = useCallback(async () => {
    try {
      const cachedIds = await getCachedChordSheets();
      const sheets: CachedSheet[] = [];

      for (const id of cachedIds.slice(-10).reverse()) { // Last 10, newest first
        const sheet = await getCachedChordSheet(id);
        if (sheet) {
          sheets.push({ id, ...sheet });
        }
      }

      setRecentSheets(sheets);
    } catch (error) {
      console.warn('Error loading recent sheets:', error);
    }
  }, []);

  // Haptic feedback for button taps
  const onTap = useCallback(async () => {
    await hapticFeedback('light');
  }, []);

  const onSelect = useCallback(async () => {
    await hapticFeedback('medium');
  }, []);

  const onSuccess = useCallback(async () => {
    await hapticSuccess();
  }, []);

  // Share functionality
  const share = useCallback(async (title: string, url?: string) => {
    await hapticFeedback('light');
    await nativeShare({
      title,
      text: `${title} - 찬양팀 악보`,
      url: url || window.location.href,
    });
  }, []);

  // Cache a viewed sheet
  const cacheSheet = useCallback(async (sheet: {
    id: string;
    title: string;
    imageUrl: string;
    key?: string;
  }) => {
    await cacheChordSheet(sheet.id, {
      title: sheet.title,
      imageUrl: sheet.imageUrl,
      key: sheet.key,
    });
    // Reload recent sheets
    await loadRecentSheets();
  }, [loadRecentSheets]);

  return {
    isNative,
    isIOS,
    initialized,
    recentSheets,
    // Haptic functions
    onTap,
    onSelect,
    onSuccess,
    // Share
    share,
    // Caching
    cacheSheet,
    loadRecentSheets,
  };
}

export default useNative;
