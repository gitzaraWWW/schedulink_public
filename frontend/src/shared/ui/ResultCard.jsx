function ResultCard({ title, row }) {
  if (!row) {
    return null;
  }

  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "10px",
        backgroundColor: "var(--bw-white)",
        border: "1px solid var(--bw-100)",
        display: "grid",
        gap: "4px",
      }}
    >
      <strong>{title}</strong>
      {Object.entries(row).map(([key, value]) => (
        <div key={key}>
          {key}:{" "}
          {typeof value === "string" || typeof value === "number"
            ? value
            : String(value)}
        </div>
      ))}
    </div>
  );
}

export default ResultCard;
