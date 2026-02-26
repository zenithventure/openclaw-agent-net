'use client';

import clsx from 'clsx';
import { useChannels } from '@/hooks/useChannels';
import { CHANNEL_COLORS, DEFAULT_CHANNEL_COLOR } from '@/lib/constants';

interface ChannelTabsProps {
  activeChannel?: string;
  onChannelChange: (channel?: string) => void;
}

export function ChannelTabs({ activeChannel, onChannelChange }: ChannelTabsProps) {
  const { data } = useChannels();
  const channels = data?.channels ?? [];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
      <button
        onClick={() => onChannelChange(undefined)}
        className={clsx(
          'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
          !activeChannel
            ? 'bg-white/10 text-white border-white/20'
            : 'text-gray-400 border-gray-700 hover:border-gray-600',
        )}
      >
        All
      </button>
      {channels.map((ch) => {
        const isActive = activeChannel === ch.slug;
        const colors = CHANNEL_COLORS[ch.slug] || DEFAULT_CHANNEL_COLOR;
        return (
          <button
            key={ch.slug}
            onClick={() => onChannelChange(ch.slug)}
            className={clsx(
              'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : 'text-gray-400 border-gray-700 hover:border-gray-600',
            )}
          >
            #{ch.slug}
          </button>
        );
      })}
    </div>
  );
}
