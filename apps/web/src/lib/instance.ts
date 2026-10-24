import "server-only";

/**
 * Instance options, read from the web server's environment at request time
 * (set them on the deployment — no rebuild). Client components get the same
 * values from `useInstance()` (lib/instance-context.tsx); the root layout
 * hands them down.
 *
 * - BILLING=ON: show pricing, plans and upgrade prompts. Must match the API
 *   server's BILLING. Anything else hides every plan/pricing hint.
 * - PRIVATE_BUZZ=ON: a private instance — no marketing pages, a bare landing
 *   page (1v1, join room, admin login), no donation prompts, footer links
 *   only for signed-in users.
 * - TITLE: site name / browser title / app manifest (empty = Buzrr).
 * - CONTACT_EMAIL: on a private instance "Contact us" points here (hidden
 *   when unset).
 * - DUELS=OFF: no 1v1 duels — no "Start 1v1", no public (duel pool) option
 *   on quizzes, no duel stats, duel pages redirect home.
 */
export interface InstanceConfig {
  billing: boolean;
  privateBuzz: boolean;
  title: string;
  contactEmail: string;
  duels: boolean;
}

const read = (name: string) => (process.env[name] ?? "").trim();

export function getInstanceConfig(): InstanceConfig {
  return {
    billing: read("BILLING").toUpperCase() === "ON",
    privateBuzz: read("PRIVATE_BUZZ").toUpperCase() === "ON",
    title: read("TITLE"),
    contactEmail: read("CONTACT_EMAIL"),
    duels: read("DUELS").toUpperCase() !== "OFF",
  };
}
