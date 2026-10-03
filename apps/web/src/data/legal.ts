/** The legal pages under app/(marketing). Bump `LEGAL_UPDATED` whenever any of their text changes. */
export const LEGAL_UPDATED = "3 October 2026";

export const LEGAL_PAGES = [
  { path: "/privacy", name: "Privacy Policy" },
  { path: "/terms", name: "Terms & Conditions" },
  { path: "/refund-policy", name: "Refund & Cancellation Policy" },
] as const;
