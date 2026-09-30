export function TagFinderInput({ value, onChange, disabled }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return <label className="mb-2 block text-xs text-(--text-muted)">
    Find tags
    <input type="search" value={value} disabled={disabled}
      onChange={(event) => onChange(event.target.value)} placeholder="Find a tag..."
      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
      className="mt-1 min-h-9 w-full rounded-lg border border-(--border) bg-(--surface) px-2 text-xs text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50" />
  </label>;
}
