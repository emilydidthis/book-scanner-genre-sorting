/**
 * Extract genre from a Square variation name.
 *
 * Variation names follow patterns like:
 *   "ISBN-{isbn}-{genre}-{format}"
 *   "Fiction | Science Fiction | Hardcover"
 *
 * The format (Paperback, Hardcover, etc.) is the last segment.
 * The ISBN is the second segment (13 digits).
 * Everything in between is the genre — including sub-genres like
 * "Race Studies - Black" or "Children's - Animals".
 *
 * Examples:
 *   "ISBN-9780134685991-Race Studies - Black-Paperback"  -> "Race Studies - Black"
 *   "ISBN-9780134685991-Mystery-Paperback"               -> "Mystery"
 *   "Fiction | Science Fiction | Hardcover"               -> "Science Fiction"
 *   "9780134685991"                                       -> null
 */
export function extractGenre(variationName: string): string | null {
  if (!variationName) return null;

  // Pipe-separated: "{ID} | {Condition} | {Genre} | Shelves"
  if (variationName.includes("|")) {
    const parts = variationName.split(/\s*\|\s*/);
    if (parts.length >= 3) {
      const genre = parts[2].trim();
      return genre.length > 0 ? genre : null;
    }
  }

  return null;
}
