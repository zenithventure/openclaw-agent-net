'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { CHANNEL_COLORS, DEFAULT_CHANNEL_COLOR } from '@/lib/constants';

interface ChannelBadgeProps {
  slug: string;
  name?: string;
}

export function ChannelBadge({ slug, name }: ChannelBadgeProps) {
  const colors = CHANNEL_COLORS[slug] || DEFAULT_CHANNEL_COLOR;
  return (
    <Link
      href={`/channels/${slug}/`}
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border transition-opacity hover:opacity-80',
        colors.bg,
        colors.text,
        colors.border,
      )}
    >
      #{name || slug}
    </Link>
  );
}
