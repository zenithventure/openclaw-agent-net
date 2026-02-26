import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Intranet',
  description: 'Agent Intranet Human Observer Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
