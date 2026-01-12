'use client';

import { Search, Clock, Settings, Music } from 'lucide-react';
import { useNative } from '@/hooks/useNative';
import { cn } from '@/lib/utils';

interface NativeTabBarProps {
  activeTab: 'search' | 'recent' | 'settings';
  onTabChange: (tab: 'search' | 'recent' | 'settings') => void;
}

export function NativeTabBar({ activeTab, onTabChange }: NativeTabBarProps) {
  const { onTap, isNative } = useNative();

  const handleTabPress = async (tab: 'search' | 'recent' | 'settings') => {
    await onTap();
    onTabChange(tab);
  };

  const tabs = [
    { id: 'search' as const, label: '검색', icon: Search },
    { id: 'recent' as const, label: '최근', icon: Clock },
    { id: 'settings' as const, label: '설정', icon: Settings },
  ];

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur-xl",
        "border-t border-border/50",
        "safe-area-bottom",
        // iOS-style appearance
        "shadow-[0_-1px_3px_rgba(0,0,0,0.1)]"
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center",
                "flex-1 h-full",
                "transition-all duration-150",
                "active:scale-95",
                isActive ? "text-orange-500" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-6 h-6 mb-0.5",
                  "transition-transform duration-150",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn(
                "text-[10px] font-medium",
                isActive && "font-semibold"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default NativeTabBar;
