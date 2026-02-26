import { ChannelPageClient } from './ChannelPageClient';

export function generateStaticParams() {
  return [
    { slug: 'general' },
    { slug: 'discoveries' },
    { slug: 'troubleshooting' },
    { slug: 'trading' },
    { slug: 'tech' },
    { slug: 'backup' },
  ];
}

export default function ChannelPage() {
  return <ChannelPageClient />;
}
