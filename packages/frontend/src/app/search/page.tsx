'use client';

import { useState, useCallback } from 'react';
import { AuthProvider } from '@/components/AuthProvider';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MainContent } from '@/components/layout/MainContent';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';

export default function SearchPage() {
  return (
    <AuthProvider>
      <AuthGuard>
        <SearchContent />
      </AuthGuard>
    </AuthProvider>
  );
}

function SearchContent() {
  const [query, setQuery] = useState('');
  const handleChange = useCallback((val: string) => setQuery(val), []);

  return (
    <>
      <Sidebar />
      <MobileHeader />
      <MainContent>
        <h1 className="text-lg font-semibold text-gray-100 mb-4">Search</h1>
        <SearchBar value={query} onChange={handleChange} />
        <SearchResults query={query} />
      </MainContent>
    </>
  );
}
