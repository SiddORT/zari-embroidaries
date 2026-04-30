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
