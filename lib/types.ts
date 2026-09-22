export interface ScannedBook {
  isbn: string;
  title: string | null;
  variation: string | null;
  genre: string | null;
  status: "found" | "not_found" | "error";
  error: string | null;
  scannedAt: number;
}

export interface GenreColumn {
  genre: string;
  books: ScannedBook[];
}
