/**
 * Native Capacitor Utilities
 * Provides native functionality for iOS app
 * These features help pass Apple's App Store Guideline 4.2 (Minimum Functionality)
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

// Check if running on native platform
export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';

/**
 * Initialize native app features
 * Call this on app startup
 */
export async function initializeNativeApp() {
  if (!isNative) return;

  try {
    // Configure status bar for dark theme
    await StatusBar.setStyle({ style: Style.Dark });

    // Hide splash screen after app loads
    await SplashScreen.hide();
  } catch (error) {
    console.warn('Native initialization error:', error);
  }
}

/**
 * Haptic feedback - provides tactile response
 * Used for button taps, selections, etc.
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative) return;

  try {
    const impactStyle = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    }[style];

    await Haptics.impact({ style: impactStyle });
  } catch (error) {
    console.warn('Haptic feedback error:', error);
  }
}

/**
 * Success haptic notification
 */
export async function hapticSuccess() {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: 'success' as any });
  } catch (error) {
    console.warn('Haptic error:', error);
  }
}

/**
 * Native share functionality
 * Opens the native iOS share sheet
 */
export async function nativeShare(options: {
  title?: string;
  text?: string;
  url?: string;
}) {
  if (!isNative) {
    // Fallback for web
    if (navigator.share) {
      await navigator.share(options);
    }
    return;
  }

  try {
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: '악보 공유',
    });
  } catch (error) {
    console.warn('Share error:', error);
  }
}

/**
 * Local storage using native Preferences
 * Used for offline caching of viewed chord sheets
 */
export async function saveToLocal(key: string, value: string) {
  if (!isNative) {
    localStorage.setItem(key, value);
    return;
  }

  try {
    await Preferences.set({ key, value });
  } catch (error) {
    console.warn('Save error:', error);
    localStorage.setItem(key, value);
  }
}

export async function getFromLocal(key: string): Promise<string | null> {
  if (!isNative) {
    return localStorage.getItem(key);
  }

  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch (error) {
    console.warn('Get error:', error);
    return localStorage.getItem(key);
  }
}

export async function removeFromLocal(key: string) {
  if (!isNative) {
    localStorage.removeItem(key);
    return;
  }

  try {
    await Preferences.remove({ key });
  } catch (error) {
    console.warn('Remove error:', error);
    localStorage.removeItem(key);
  }
}

/**
 * Cache a viewed chord sheet for offline access
 */
export async function cacheChordSheet(songId: string, data: {
  title: string;
  imageUrl: string;
  key?: string;
}) {
  const cacheKey = `chord_sheet_${songId}`;
  await saveToLocal(cacheKey, JSON.stringify({
    ...data,
    cachedAt: Date.now(),
  }));

  // Also update the list of cached sheets
  const cachedList = await getFromLocal('cached_sheets_list');
  const list = cachedList ? JSON.parse(cachedList) : [];
  if (!list.includes(songId)) {
    list.push(songId);
    await saveToLocal('cached_sheets_list', JSON.stringify(list));
  }
}

/**
 * Get cached chord sheets for offline viewing
 */
export async function getCachedChordSheets(): Promise<string[]> {
  const cachedList = await getFromLocal('cached_sheets_list');
  return cachedList ? JSON.parse(cachedList) : [];
}

/**
 * Get a specific cached chord sheet
 */
export async function getCachedChordSheet(songId: string) {
  const cacheKey = `chord_sheet_${songId}`;
  const data = await getFromLocal(cacheKey);
  return data ? JSON.parse(data) : null;
}
