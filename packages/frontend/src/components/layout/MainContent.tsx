'use client';

export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="md:ml-60 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {children}
      </div>
    </main>
  );
}
