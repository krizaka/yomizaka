/** Removes, from both ends of a text, the characters of `chars` (the same as `replace(/^[chars]+|[chars]+$/g, "")`, in one pass: no backtracking on a long run). */
export function trimEdges(text: string, chars: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start]!)) start++;
  while (end > start && chars.includes(text[end - 1]!)) end--;
  return text.slice(start, end);
}
