import { ScannedBook } from "./types";
import { extractGenre } from "./genre";

const SQUARE_VERSION = "2026-05-20";

export function getSquareBaseUrl(): string {
  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

export async function lookupISBN(
  accessToken: string,
  isbn: string
): Promise<ScannedBook> {
  const baseUrl = getSquareBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/v2/catalog/search-catalog-items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text_filter: isbn,
        limit: 10,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        isbn,
        title: null,
        variation: null,
        genre: null,
        status: "error",
        error: data.errors?.[0]?.detail || `API error (${res.status})`,
        scannedAt: Date.now(),
      };
    }

    const data = await res.json();

    console.log("Square response for ISBN", isbn, ":", JSON.stringify(data.items?.map((item: any) => ({
      name: item.item_data?.name,
      variations: item.item_data?.variations?.map((v: any) => v.item_variation_data?.name),
    })), null, 2));

    const matchedIds = new Set(data.matched_variation_ids || []);

    const items = (data.items || [])
      .map((item: any) => ({
        name: item.item_data?.name,
        variations: (item.item_data?.variations || [])
          .filter((v: any) => matchedIds.has(v.id))
          .map((v: any) => v.item_variation_data?.name || "(unnamed)"),
      }))
      .filter((r: any) => r.variations.length > 0);

    if (items.length === 0) {
      return {
        isbn,
        title: null,
        variation: null,
        genre: null,
        status: "not_found",
        error: null,
        scannedAt: Date.now(),
      };
    }

    const title = items[0].name;
    const variation = items[0].variations[0];
    const genre = extractGenre(variation);

    return {
      isbn,
      title,
      variation,
      genre,
      status: "found",
      error: null,
      scannedAt: Date.now(),
    };
  } catch {
    return {
      isbn,
      title: null,
      variation: null,
      genre: null,
      status: "error",
      error: "Network error",
      scannedAt: Date.now(),
    };
  }
}
