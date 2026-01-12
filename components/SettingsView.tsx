'use client';

import { Moon, Sun, Globe, Info, Shield, Trash2, ExternalLink } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/components/LanguageProvider';
import { useNative } from '@/hooks/useNative';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { onTap, isNative, recentSheets } = useNative();

  const handleThemeToggle = async () => {
    await onTap();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLanguageToggle = async () => {
    await onTap();
    setLanguage(language === 'ko' ? 'en' : 'ko');
  };

  const handleClearCache = async () => {
    await onTap();
    if (confirm('최근 본 악보 기록을 삭제하시겠습니까?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* App Info */}
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
          <span className="text-3xl">🎵</span>
        </div>
        <h2 className="text-xl font-bold">찬양팀 악보</h2>
        <p className="text-sm text-muted-foreground">Worship Song Finder</p>
        <p className="text-xs text-muted-foreground mt-1">v1.0.0</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Appearance */}
        <SettingsSection title="화면">
          <SettingsRow
            icon={theme === 'dark' ? Moon : Sun}
            label="다크 모드"
            value={theme === 'dark' ? '켜짐' : '꺼짐'}
            onClick={handleThemeToggle}
          />
          <SettingsRow
            icon={Globe}
            label="언어"
            value={language === 'ko' ? '한국어' : 'English'}
            onClick={handleLanguageToggle}
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="데이터">
          <SettingsRow
            icon={Trash2}
            label="캐시 삭제"
            value={`${recentSheets.length}개 저장됨`}
            onClick={handleClearCache}
            destructive
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="정보">
          <Link href="/privacy" className="block">
            <SettingsRow
              icon={Shield}
              label="개인정보 처리방침"
              showArrow
            />
          </Link>
          <SettingsRow
            icon={Info}
            label="앱 정보"
            value="v1.0.0"
          />
        </SettingsSection>
      </div>

      {/* Footer */}
      <div className="text-center pt-4 pb-20">
        <p className="text-xs text-muted-foreground">
          Made with ❤️ for worship teams
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          © 2026 FindMyWorship
        </p>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h3>
      <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  showArrow,
  destructive,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
  showArrow?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          destructive ? "bg-red-500/10" : "bg-orange-500/10"
        )}>
          <Icon className={cn(
            "w-4 h-4",
            destructive ? "text-red-500" : "text-orange-500"
          )} />
        </div>
        <span className={cn(
          "font-medium",
          destructive && "text-red-500"
        )}>
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {value && (
          <span className="text-sm text-muted-foreground">{value}</span>
        )}
        {showArrow && (
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors active:bg-muted"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between p-3">
      {content}
    </div>
  );
}

export default SettingsView;
