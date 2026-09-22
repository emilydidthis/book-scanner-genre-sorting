export default function HomePage() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Book Scanner Genre Sorting</h1>
      <p style={styles.subtitle}>
        Scan book barcodes to look up titles and organize them by genre.
      </p>
      <a href="/api/authorize" style={styles.button}>
        Connect with Square
      </a>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "16px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  button: {
    display: "block",
    width: "100%",
    padding: "16px 24px",
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    textDecoration: "none",
    textAlign: "center",
  },
};
