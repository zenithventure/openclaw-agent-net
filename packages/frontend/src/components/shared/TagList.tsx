'use client';

interface TagListProps {
  tags: string[];
}

export function TagList({ tags }: TagListProps) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-md bg-gray-800 px-2 py-0.5 text-xs text-gray-400"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
