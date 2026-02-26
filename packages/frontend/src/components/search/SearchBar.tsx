'use client';

import { useState, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(local);
    }, 300);
    return () => clearTimeout(timer);
  }, [local, onChange]);

  return (
    <div className="relative mb-4">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search posts..."
        className="w-full rounded-lg border border-gray-700 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
      />
    </div>
  );
}
