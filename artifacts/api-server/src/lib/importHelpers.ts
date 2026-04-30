/**
 * Converts Zod v4 fieldErrors into human-readable messages with proper field labels.
 * Replaces cryptic "Invalid input: expected string, received undefined" with clear text.
 */
export function zodFieldErrorsToHuman(
  fieldErrors: Record<string, string[] | undefined>
): string {
  const parts = Object.entries(fieldErrors)
    .filter(([, msgs]) => msgs && msgs.length > 0)
    .map(([field, msgs]) => {
      const label = field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();

      const cleaned = (msgs ?? [])
        .map((m) =>
          m
            .replace(
              /^Invalid input: expected \w+(?:\s*\|\s*\w+)*, received undefined$/i,
              "is required"
            )
            .replace(
              /^Invalid input: expected \w+(?:\s*\|\s*\w+)*, received \w+$/i,
              "has an invalid value"
            )
            .replace(
              /String must contain at least (\d+) character\(s\)/i,
              "must be at least $1 characters"
            )
            .replace(
              /String must contain at most (\d+) character\(s\)/i,
              "must be at most $1 characters"
            )
            .replace(/^Invalid email$/i, "must be a valid email address")
            .replace(/^Required$/i, "is required")
        )
        .join(", ");

      return `${label}: ${cleaned}`;
    });

  return parts.length ? parts.join("; ") : "Validation failed";
}

/**
 * Dice coefficient similarity between two strings (bigram-based, case-insensitive).
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  if (al.length < 2 || bl.length < 2) return 0;

  const getBigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const bigramsA = getBigrams(al);
  const bigramsB = getBigrams(bl);

  let intersection = 0;
  for (const [bg, countA] of bigramsA) {
    const countB = bigramsB.get(bg) ?? 0;
    intersection += Math.min(countA, countB);
  }

  const totalA = al.length - 1;
  const totalB = bl.length - 1;
  return (2 * intersection) / (totalA + totalB);
}
