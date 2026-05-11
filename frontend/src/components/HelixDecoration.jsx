// Decorative DNA double-helix rendered in the top-right of <main>.
// Inherits the biotech green palette via currentColor / CSS variables.
export default function HelixDecoration() {
  return (
    <svg
      className="helix-decoration"
      viewBox="0 0 400 800"
      width="400"
      height="800"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M100 0C100 200 300 200 300 400C300 600 100 600 100 800"
        stroke="var(--primary-container)"
        strokeLinecap="round"
        strokeWidth="40"
      />
      <path
        d="M300 0C300 200 100 200 100 400C100 600 300 600 300 800"
        opacity="0.5"
        stroke="var(--primary-container)"
        strokeLinecap="round"
        strokeWidth="40"
      />
    </svg>
  );
}
