// components/ui/Badge.tsx
// Status and verdict badges used across the dashboard.

type Variant = "ready" | "needs_review" | "blocked" | "unknown" |
               "approved" | "rejected" | "revision";

const STYLES: Record<Variant, string> = {
  ready:       "bg-emerald-100 text-emerald-800 border-emerald-200",
  approved:    "bg-emerald-100 text-emerald-800 border-emerald-200",
  needs_review:"bg-amber-100  text-amber-800  border-amber-200",
  revision:    "bg-amber-100  text-amber-800  border-amber-200",
  blocked:     "bg-red-100    text-red-800    border-red-200",
  rejected:    "bg-red-100    text-red-800    border-red-200",
  unknown:     "bg-gray-100   text-gray-600   border-gray-200",
};

const LABELS: Record<Variant, string> = {
  ready:        "Ready",
  approved:     "Approved",
  needs_review: "Needs Review",
  revision:     "Revision",
  blocked:      "Blocked",
  rejected:     "Rejected",
  unknown:      "Unknown",
};

export default function Badge({ variant }: { variant: Variant }) {
  const style = STYLES[variant] ?? STYLES.unknown;
  const label = LABELS[variant] ?? variant;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}