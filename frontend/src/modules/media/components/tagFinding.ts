import { useState } from "react";

import type { Tag } from "../services/tagApi";

function normalize(value: string) {
  return value.trim().toLowerCase().replaceAll("đ", "d")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function editDistanceAtMost(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > 1) return false;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    if (Math.min(...current) > limit) return false;
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] <= limit;
}

export function findTags(tags: Tag[], input: string): Tag[] {
  const query = normalize(input);
  if (!query) return tags;
  const matches: Array<{ tag: Tag; rank: number; index: number }> = [];
  tags.forEach((tag, index) => {
    const name = normalize(tag.name);
    const rank = name === query ? 0 : name.startsWith(query) ? 1
      : name.includes(query) ? 2
      : /^[a-z0-9]{4,32}$/.test(query) && name.split(/[^a-z0-9]+/).some((word) =>
        word.length >= 4 && word.length <= 32 && word[0] === query[0] &&
        editDistanceAtMost(word, query, query.length === 4 ? 1 : 2)) ? 3 : -1;
    if (rank >= 0) matches.push({ tag, rank, index });
  });
  return matches.sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ tag }) => tag);
}

export function useTagFinder(tags: Tag[]) {
  const [tagSearch, setTagSearch] = useState("");
  return { tagSearch, setTagSearch, visibleTags: findTags(tags, tagSearch) };
}
