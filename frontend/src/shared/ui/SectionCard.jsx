const baseStyle = {
  padding: "16px",
  border: "1px solid var(--bw-150)",
  borderRadius: "12px",
  backgroundColor: "var(--bw-25)",
  display: "grid",
  gap: "12px",
};

function SectionCard({ children, style }) {
  return <div style={{ ...baseStyle, ...style }}>{children}</div>;
}

export default SectionCard;
