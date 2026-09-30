import { useEffect, useState } from "react";

export function useDebouncedSearch(text: string, delay = 350) {
  const [query, setQuery] = useState(text.trim());

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), delay);
    return () => window.clearTimeout(timer);
  }, [text, delay]);

  return [query, (value: string) => setQuery(value.trim())] as const;
}
