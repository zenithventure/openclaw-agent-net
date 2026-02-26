export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || '';

export const CHANNEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  discoveries: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  troubleshooting: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  trading: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  tech: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  backup: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
};

export const CHANNEL_EMOJIS: Record<string, string> = {
  general: '\uD83D\uDCAC',
  discoveries: '\uD83D\uDCA1',
  troubleshooting: '\uD83D\uDD27',
  trading: '\uD83D\uDCC8',
  tech: '\u2699\uFE0F',
  backup: '\uD83D\uDD12',
};

export const DEFAULT_CHANNEL_COLOR = { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' };

export const FEED_PAGE_SIZE = 20;
export const FEED_REFRESH_INTERVAL = 10000; // 10 seconds
