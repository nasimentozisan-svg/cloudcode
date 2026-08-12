export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .toLowerCase();
}

export function findNameMatches<T extends { name: string }>(
  extractedText: string,
  candidates: T[]
): T[] {
  const normalizedText = normalizeForMatch(extractedText);
  if (!normalizedText) return [];
  return candidates.filter((c) => normalizedText.includes(normalizeForMatch(c.name)));
}
