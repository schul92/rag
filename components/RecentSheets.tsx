'use client';

import { Clock, Music, WifiOff } from 'lucide-react';
import { useNative, CachedSheet } from '@/hooks/useNative';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface RecentSheetsProps {
  onSelectSheet: (sheet: CachedSheet) => void;
}

export function RecentSheets({ onSelectSheet }: RecentSheetsProps) {
  const { recentSheets, onTap, isNative } = useNative();

  const handleSheetClick = async (sheet: CachedSheet) => {
    await onTap();
    onSelectSheet(sheet);
  };

  if (recentSheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">최근 본 악보 없음</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          검색해서 악보를 보면 여기에 저장됩니다.
          <br />
          오프라인에서도 볼 수 있어요!
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <WifiOff className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          오프라인에서도 볼 수 있는 악보
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {recentSheets.map((sheet) => (
          <button
            key={sheet.id}
            onClick={() => handleSheetClick(sheet)}
            className={cn(
              "relative group",
              "bg-card rounded-xl overflow-hidden",
              "border border-border/50",
              "transition-all duration-200",
              "hover:border-orange-500/50 hover:shadow-lg",
              "active:scale-[0.98]"
            )}
          >
            {/* Image */}
            <div className="aspect-[3/4] relative bg-muted">
              <Image
                src={sheet.imageUrl}
                alt={sheet.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 200px"
              />

              {/* Key badge */}
              {sheet.key && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                  {sheet.key}
                </div>
              )}

              {/* Offline indicator */}
              <div className="absolute top-2 left-2 p-1 rounded-full bg-black/50">
                <WifiOff className="w-3 h-3 text-white" />
              </div>
            </div>

            {/* Title */}
            <div className="p-2">
              <p className="text-xs font-medium line-clamp-2 text-left">
                {sheet.title}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatTimeAgo(sheet.cachedAt)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return new Date(timestamp).toLocaleDateString('ko-KR');
}

export default RecentSheets;
