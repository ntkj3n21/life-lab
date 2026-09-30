import { Folder } from "lucide-react";

import type { Category } from "../services/categoryApi";

interface CategoryScopeRowProps {
  categories: Category[];
  selectedId?: number;
  onSelect: (categoryId: number | undefined) => void;
}

export function CategoryScopeRow({
  categories,
  selectedId,
  onSelect,
}: CategoryScopeRowProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Category scope" className="mt-5 min-w-0 overflow-x-auto pb-1">
      <div className="flex w-max min-w-full items-center gap-2">
        <Folder size={15} className="mr-1 shrink-0 text-(--text-muted)" aria-hidden="true" />
        <button
          type="button"
          aria-pressed={selectedId === undefined}
          onClick={() => onSelect(undefined)}
          className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${selectedId === undefined ? "border-(--border-strong) bg-(--surface-active) text-(--text-primary)" : "border-(--border) text-(--text-muted) hover:bg-(--surface-hover)"}`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={selectedId === category.id}
            onClick={() => onSelect(category.id)}
            className={`min-h-9 max-w-52 shrink-0 truncate rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${selectedId === category.id ? "border-(--border-strong) bg-(--surface-active) text-(--text-primary)" : "border-(--border) text-(--text-muted) hover:bg-(--surface-hover)"}`}
            title={category.name}
          >
            {category.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
