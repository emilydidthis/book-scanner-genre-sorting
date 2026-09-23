"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ScannedBook, GenreColumn } from "@/lib/types";

const GENRE_COLORS: Record<string, string> = {};

const GENRE_PALETTE = [
  "#6366f1",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#e11d48",
  "#0891b2",
  "#7c3aed",
  "#059669",
];

function getGenreColor(genre: string): string {
  if (GENRE_COLORS[genre]) return GENRE_COLORS[genre];
  const idx = Object.keys(GENRE_COLORS).length % GENRE_PALETTE.length;
  GENRE_COLORS[genre] = GENRE_PALETTE[idx];
  return GENRE_COLORS[genre];
}

export default function ScanPage() {
  const [books, setBooks] = useState<Map<string, ScannedBook>>(new Map());
  const [scanOrder, setScanOrder] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [hoveredIsbn, setHoveredIsbn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bookshelfRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastLookupRef = useRef(0);

  useEffect(() => {
    fetch("/api/auth-check").then((res) => {
      if (!res.ok) {
        window.location.href = "/";
      }
    });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    if (bookshelfRef.current) {
      bookshelfRef.current.scrollLeft = bookshelfRef.current.scrollWidth;
    }
  }, [scanOrder.length]);

  useEffect(() => {
    if (!hoveredIsbn || !bookshelfRef.current) return;
    const el = bookshelfRef.current.querySelector(`[data-isbn="${hoveredIsbn}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center" });
  }, [hoveredIsbn]);

  const playSound = useCallback((type: "success" | "duplicate") => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === "success") {
        oscillator.frequency.value = 880;
        oscillator.type = "sine";
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } else {
        oscillator.frequency.value = 440;
        oscillator.type = "square";
        gainNode.gain.value = 0.2;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Audio not available
    }
  }, []);

  const lookupIsbn = useCallback(
    async (isbn: string) => {
      const trimmed = isbn.trim();
      if (!trimmed) return;

      const now = Date.now();
      if (now - lastLookupRef.current < 500) return;
      lastLookupRef.current = now;

      if (books.has(trimmed)) {
        setDuplicateNotice(trimmed);
        setTimeout(() => setDuplicateNotice(null), 2000);
        playSound("duplicate");
        setInputValue("");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbn: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Lookup failed");
          setIsLoading(false);
          return;
        }

        const book: ScannedBook = data;

        setBooks((prev) => {
          const next = new Map(prev);
          next.set(trimmed, book);
          return next;
        });

        setScanOrder((prev) => [...prev, trimmed]);

        setTimeout(() => {}, 1500);

        if (book.status === "found") {
          playSound("success");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setIsLoading(false);
        setInputValue("");
      }
    },
    [books, playSound]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length === 13) {
      lookupIsbn(digitsOnly);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupIsbn(inputValue);
    }
  };

  const deleteGenre = useCallback(
    (genre: string) => {
      setBooks((prev) => {
        const next = new Map(prev);
        Array.from(prev.entries()).forEach(([isbn, book]) => {
          const bookGenre = book.genre || "Uncategorized";
          if (bookGenre === genre) {
            next.delete(isbn);
          }
        });
        return next;
      });

      setScanOrder((prev) =>
        prev.filter((isbn) => {
          const book = books.get(isbn);
          if (!book) return false;
          return (book.genre || "Uncategorized") !== genre;
        })
      );
    },
    [books]
  );

  const columns = useMemo((): GenreColumn[] => {
    const genreMap = new Map<string, ScannedBook[]>();

    scanOrder.forEach((isbn) => {
      const book = books.get(isbn);
      if (!book) return;
      const genre = book.genre || "Uncategorized";
      if (!genreMap.has(genre)) {
        genreMap.set(genre, []);
      }
      genreMap.get(genre)!.push(book);
    });

    const sorted = Array.from(genreMap.entries()).sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });

    return sorted.map(([genre, books]) => ({ genre, books }));
  }, [books, scanOrder]);

  const stats = useMemo(() => {
    const allBooks = Array.from(books.values());
    return {
      scanned: allBooks.length,
      found: allBooks.filter((b) => b.status === "found").length,
      notFound: allBooks.filter((b) => b.status === "not_found").length,
      error: allBooks.filter((b) => b.status === "error").length,
    };
  }, [books]);

  const resetSession = useCallback(() => {
    if (
      books.size > 0 &&
      !confirm("Clear all scanned books? This cannot be undone.")
    ) {
      return;
    }
    setBooks(new Map());
    setScanOrder([]);
    setInputValue("");
    setError(null);
    setDuplicateNotice(null);
    setHoveredIsbn(null);
    GENRE_COLORS;
    Object.keys(GENRE_COLORS).forEach((k) => delete GENRE_COLORS[k]);
    inputRef.current?.focus();
  }, [books.size]);

  const scannedBooks = useMemo(
    () => scanOrder.map((isbn) => books.get(isbn)).filter(Boolean) as ScannedBook[],
    [scanOrder, books]
  );

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <a href="/" style={styles.backLink}>
            Home
          </a>
          <h1 style={styles.title}>Book Scanner</h1>
        </div>
        <div style={styles.stats}>
          <span style={styles.statItem}>
            <strong>{stats.scanned}</strong> scanned
          </span>
          <span style={{ ...styles.statItem, color: "#166534" }}>
            <strong>{stats.found}</strong> found
          </span>
          {stats.notFound > 0 && (
            <span style={{ ...styles.statItem, color: "#92400e" }}>
              <strong>{stats.notFound}</strong> not found
            </span>
          )}
          {stats.error > 0 && (
            <span style={{ ...styles.statItem, color: "#991b1b" }}>
              <strong>{stats.error}</strong> errors
            </span>
          )}
        </div>
      </div>

      <div style={styles.inputSection}>
        <input
          ref={inputRef}
          style={styles.input}
          type="text"
          inputMode="numeric"
          placeholder="Scan or type ISBN..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
        />
        {isLoading && (
          <span style={styles.loadingIndicator}>Looking up...</span>
        )}
        {duplicateNotice && (
          <span style={styles.duplicateNotice}>
            Already scanned: {duplicateNotice}
          </span>
        )}
        {error && <span style={styles.errorNotice}>{error}</span>}
      </div>

      {scannedBooks.length > 0 && (
        <>
          <div style={styles.shelfLabel}>Scanned books &rarr;</div>
          <div ref={bookshelfRef} style={styles.bookshelf}>
            {scannedBooks.map((book, index) => {
              const genre = book.genre || "Uncategorized";
              const color = getGenreColor(genre);
              return (
                <div
                  key={book.isbn}
                  data-isbn={book.isbn}
                  style={{
                    ...styles.bookshelfCard,
                    borderLeftColor: color,
                    ...(hoveredIsbn === book.isbn
                      ? { backgroundColor: "#fef9c3", borderLeftColor: "#eab308" }
                      : {}),
                  }}
                  onMouseEnter={() => setHoveredIsbn(book.isbn)}
                  onMouseLeave={() => setHoveredIsbn(null)}
                >
                  <span style={styles.scanNum}>#{index + 1}</span>
                  <div style={styles.shelfTitle}>
                    {book.title || "Not found"}
                  </div>
                  <div style={styles.shelfGenre}>{genre}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={styles.board}>
        {columns.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Scan a book barcode to get started</p>
          </div>
        ) : (
          columns.map((col) => (
            <div key={col.genre} style={styles.column}>
              <div style={styles.columnHeader}>
                <h2
                  style={{
                    ...styles.genreName,
                    color: getGenreColor(col.genre),
                  }}
                >
                  {col.genre}
                </h2>
                <div style={styles.columnHeaderRight}>
                  <span style={styles.genreCount}>{col.books.length}</span>
                  <button
                    style={styles.deleteGenreBtn}
                    title={`Remove ${col.genre}`}
                    onClick={() => deleteGenre(col.genre)}
                  >
                    &times;
                  </button>
                </div>
              </div>
              <div style={styles.columnBooks}>
                {col.books.map((book) => {
                  const isHighlighted = hoveredIsbn === book.isbn;
                  const scanIndex = scanOrder.indexOf(book.isbn);
                  return (
                    <div
                      key={book.isbn}
                      style={{
                        ...styles.bookCard,
                        ...(isHighlighted ? styles.bookCardHighlight : {}),
                      }}
                      onMouseEnter={() => setHoveredIsbn(book.isbn)}
                      onMouseLeave={() => setHoveredIsbn(null)}
                    >
                      <span style={styles.scanNum}>#{scanIndex + 1}</span>
                      <div style={styles.bookTitle}>
                        {book.title ||
                          (book.status === "not_found"
                            ? "Not found"
                            : book.error || "Error")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {books.size > 0 && (
        <div style={styles.actionBar}>
          <button style={styles.clearButton} onClick={resetSession}>
            Clear Session
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
    padding: "0 16px 16px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 12,
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  backLink: {
    fontSize: 14,
    color: "#3b82f6",
    textDecoration: "none",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
  },
  stats: {
    display: "flex",
    gap: 16,
    fontSize: 14,
    color: "#666",
  },
  statItem: {
    whiteSpace: "nowrap",
  },
  inputSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    maxWidth: 280,
    minWidth: 180,
    padding: "10px 14px",
    fontSize: 18,
    fontFamily: "monospace",
    border: "2px solid #3b82f6",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
  },
  loadingIndicator: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: 500,
  },
  duplicateNotice: {
    fontSize: 14,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    padding: "4px 12px",
    borderRadius: 6,
  },
  errorNotice: {
    fontSize: 14,
    color: "#991b1b",
    backgroundColor: "#fef2f2",
    padding: "4px 12px",
    borderRadius: 6,
  },
  shelfLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    padding: "0 0 4px",
  },
  bookshelf: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 12,
  },
  bookshelfCard: {
    flex: "0 0 auto",
    width: 110,
    backgroundColor: "#fff",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    borderLeft: "4px solid",
    padding: "8px 10px",
    paddingRight: 28,
    cursor: "default",
    position: "relative",
  },
  shelfTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#374151",
    lineHeight: 1.3,
    maxHeight: 52,
    overflow: "hidden",
  },
  shelfGenre: {
    fontSize: 9,
    color: "#9ca3af",
    marginTop: 3,
  },
  board: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    paddingBottom: 16,
    minHeight: 200,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
  },
  column: {
    width: 250,
    backgroundColor: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  columnHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  genreName: {
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
  },
  genreCount: {
    fontSize: 12,
    color: "#9ca3af",
    backgroundColor: "#f3f4f6",
    padding: "2px 8px",
    borderRadius: 10,
  },
  deleteGenreBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "#d1d5db",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  columnBooks: {
    padding: 8,
    maxHeight: 420,
    overflowY: "auto",
  },
  bookCard: {
    padding: "10px 12px",
    paddingRight: 28,
    borderRadius: 8,
    marginBottom: 6,
    borderLeft: "3px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    position: "relative",
  },
  bookCardHighlight: {
    backgroundColor: "#fef9c3",
    borderLeft: "3px solid #eab308",
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    lineHeight: 1.3,
  },
  scanNum: {
    position: "absolute",
    top: 5,
    right: 7,
    fontSize: 10,
    color: "#d1d5db",
    fontWeight: 600,
  },
  actionBar: {
    display: "flex",
    gap: 12,
    marginTop: 8,
    paddingBottom: 24,
  },
  clearButton: {
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    color: "#ef4444",
    backgroundColor: "#fff",
    border: "1px solid #fecaca",
    borderRadius: 8,
    cursor: "pointer",
  },
};
