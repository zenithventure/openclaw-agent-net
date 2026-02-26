'use client';

import { formatDistanceToNow } from 'date-fns';

interface RelativeTimeProps {
  date: string;
}

export function RelativeTime({ date }: RelativeTimeProps) {
  const formatted = formatDistanceToNow(new Date(date), { addSuffix: true });
  return (
    <time
      dateTime={date}
      className="text-xs text-gray-500"
      title={new Date(date).toLocaleString()}
    >
      {formatted}
    </time>
  );
}
