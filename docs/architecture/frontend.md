# Frontend (Next.js web app)

`apps/web` — Next.js 15 (App Router) + React 19, Tailwind v4 (+ some MUI,
mainly `@mui/x-charts`), Redux Toolkit + redux-persist, TanStack React Query,
socket.io-client. Default toolchain is the Next CLI; a parallel vinext/Vite
setup exists (see [infrastructure.md](infrastructure.md#vinext)).

## Route map (`src/app/`)

| Route group                                                                     | Audience                  | Gate                                                          |
| ------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `/` landing, `/changelog`, `/roadmap`, `/docs`, `/support`                      | public                    | —                                                             |
| `/auth/login`                                                                   | public                    | —                                                             |
| `/admin/(mains)` — quiz list, history, profile, settings                        | host (account)            | session in `admin/layout.tsx` (+ role via `SessionProvider`)  |
| `/admin/(quiz)/quiz/*` — quiz detail/create, post-game leaderboard              | host                      | same                                                          |
| `/admin/(gameplay)/play/[roomId]` (lobby) & `/game/[roomId]` (live host screen) | host                      | session per page                                              |
| `/admin/(mains)/ai`, `/admin/ai/[spaceId]` — AI Knowledge Spaces                | host (account)            | same; nav entry hidden unless `NEXT_PUBLIC_AI_API_URL` is set |
| `/admin/(privileged)/moderation`                                                | admin+superadmin          | role re-check in `(privileged)/layout.tsx`                    |
| `/admin/(privileged)/superadmin/admins`                                         | superadmin                | nested layout re-check                                        |
| `/player`, `/player/joinRoom/[playerId]`, `/player/play/[playerId]`             | anonymous guests          | none (player identity in localStorage)                        |
| `/join/[gameCode]`                                                              | guests via shared link/QR | none                                                          |
| `/duel`, `/duel/game/[gameCode]`, `/duel/invite/[code]`, `/duel/profile`        | account                   | per-page `requireDuelSession`                                 |

Server components handle session/role gating and param unwrapping; nearly all
real UI is in `"use client"` components under `src/components/` (`Admin/`,
`Player/`, `Duel/`, `Landing/`, shared `ui/`). The root layout wires
ReduxProvider → QueryProvider → Vercel Analytics and the SEO metadata.

Classic-mode navigation sequences (duel flow: [duels.md](duels.md#client-side-flow-web)):

- **Host**: `/admin` (quiz list) → quiz detail → host → `POST /game-sessions`
  → `/admin/play/[roomId]` (lobby; `roomId` = GameSession id) → start-game →
  `/admin/game/[roomId]` (live; the final leaderboard renders here in place —
  no auto-navigation on game over). The durable result is reached later from
  history/quiz-detail links to `/admin/quiz/leaderboard/[GameResult id]`.
- **Guest**: `/player` (create profile → localStorage identity) →
  `/player/joinRoom/[playerId]` (enter code, `POST /join`) →
  `/player/play/[playerId]` (everything in-game renders here; no route change
  per phase). Kicked/banned → back to joinRoom keeping identity; session
  ended → identity cleared, back to `/player`.
- **Link/QR join**: `/join/[gameCode]` pre-fills the code, reuses the same
  setup components.

## State model — three layers, don't mix them

1. **Server-owned live game state → `game` Redux slice**
   (`src/state/game/gameSlice.ts`). Written _only_ by socket events via
   `useGameSocket`; blacklisted from redux-persist (comment: "Live game state
   is server-owned and resynced on connect; never persist it"). Components
   read phase/question/deadline/leaderboard/you/connection from here.
2. **Fetched domain data → React Query** (`src/lib/modules/<domain>/`), one
   `api.ts` (axios fns + types) and one `hooks.ts` per backend domain, cache
   keys centralized in `lib/modules/query-keys.ts`. Results are
   `staleTime: Infinity` (immutable); the duel-invite query polls every 3s.
3. **UI prefs / rosters → small persisted Redux slices** (`state/admin/*`,
   `pageThemeSlice`, `hideQuestionsSlice`) — persisted via redux-persist
   (`state/store.ts`, version 2 with a legacy-key migration).

Guest identity is _localStorage_, not Redux: `playerId` + `playerToken`
(cleared by `lib/player-session.ts` and on `game-session-ended`).

## API access layer (`src/lib/api/`)

- `ai-client.ts` — `getAiApiClient()` for the Buzrr-AI service
  (`NEXT_PUBLIC_AI_API_URL` + `/api/ai`). Different origin, **same** token — it
  reuses `fetchApiAccessToken` because that service verifies the identical JWT.
  `isAiConfigured()` gates the sidebar entry. See [ai.md](ai.md).
- `client.ts` — axios instances against `NEXT_PUBLIC_API_URL` (or
  `NEXT_PUBLIC_SOCKET_URL`) + `/api`:
  `getAuthApiClient()` (account JWT interceptor), `createPlayerAuthedApiClient()`
  (localStorage `playerToken`), `getPublicApiClient()`.
- `get-access-token.ts` — in-memory cache of the 7d JWT from
  `/api/auth/access-token` (see [auth.md](auth.md)).
- `errors.ts` — `getApiErrorMessage` for toasts.

## Socket hooks (`src/hooks/`)

- `useGameSocket` — the core. Owns the socket lifecycle for
  `userType=admin|player|duel`, dispatches every server event into the `game`
  slice, maps connection states (including hard-fail on `io server
disconnect`), emits `request-sync` on connect as a safety net, and exposes a
  `bind` callback for role-specific listeners. New socket events get wired
  here + typed in `src/types/socket-events.ts` (hand-kept mirror of the
  server's `realtime.types.ts`).
- `useAdminSocket` — wraps it for hosts: fetches the JWT first (cookie
  fallback), maintains the lobby roster slice, surfaces
  kick/game-started/game-over callbacks.
- `usePlayerSocket` — wraps it for guests: player token from localStorage;
  handles being kicked/banned (keep identity, leave room) and session end
  (clear identity).
- `useDuelQueue` / `useDuelInvite` — standalone duel sockets (queue /
  invite waiting room), navigation on `duel:matched`
  ([duels.md](duels.md#client-side-flow-web)).
- `useServerCountdown` — display-only countdown from `deadline` +
  `clockOffset`; never triggers transitions.

## Gameplay screens (who renders what)

- Host live screen: `Admin/AdminGameLobbyClient` → `Admin/Game/*`
  (`GameLobby`, `QuestionScreen`, `QuesResult` + chart, `Leaderboard`) —
  drives the game exclusively via `start-game` / `host-next` emits.
- Guest screen: `Player/PlayPageClient` → `Player/GamePage` →
  `Player/GameScreens/*` (`Question` submits with ack + rollback toast,
  `Result`, `WaitGameStart` with the canvas bubble mini-game in `Game.tsx`,
  `Leaderboard`).
- Duel screen: `Duel/DuelGameClient` (score bar, countdown, reuses
  `GameScreens/Question`/`Result`, ELO delta panel, `DuelAudio`).
- Join flows: `Player/Setup/*` (create profile → join by code) and
  `JoinViaLinkClient` for `/join/[gameCode]` links/QR (`lib/join-link.ts`
  builds the URLs from `NEXT_PUBLIC_APP_URL`).

## Styling & UI conventions

- **Design tokens live in `src/app/globals.css`** (Tailwind v4 `@theme`
  block): the named palette used everywhere — `light-bg`/`dark-bg`,
  `lprimary`/`dprimary` (the brand purples), `card-light`/`card-dark` (+
  hover), `off-white`/`off-dark`, `red-light`/`red-dark`, `gray` — plus a
  `medium` (860px) breakpoint and custom animation utilities
  (`animate-pop`, `animate-pop-in`, `animate-fade-up`, `animate-float`,
  `animate-shake`; all disabled under `prefers-reduced-motion`). Use these
  tokens, not raw hex.
- **Dark mode is class-based**: `@custom-variant dark` keyed on a `.dark`
  class that `ThemeToggle`/`ThemeIconToggle` set on `<html>` (persisted via
  `pageThemeSlice`). Every surface styles both modes by hand
  (`bg-light-bg dark:bg-dark-bg`, `text-dark dark:text-white`) — new UI must
  too.
- **Shared primitives** in `src/components/ui/` (`Button` with variants,
  `TextInput`, `IconButton`, `Switch`, `Skeleton`, `RouteLoader`, plus `Card`
  /`CardHeader`/`EmptyState`, `Badge` and `Progress` — the first three were
  promoted out of the local `SettingsCard`/`StatusPill` patterns) and shared
  chrome components (`Modal`, `ConfirmationModal`, `ClientImage` — which
  takes `src` + `darksrc` for theme-aware images like the logo). MUI appears
  only in spots (notably `@mui/x-charts` for the host result chart).
- **Feedback**: toasts via react-toastify — a `ToastViewport` must be mounted
  in the layout (admin and player layouts have one) and API errors go through
  `getApiErrorMessage`. Connection state UI: `ConnectionBanner` /
  `ConnectionStatusPill` reading `game.connection`.

## Direct DB access from web — the exception, not the rule

Only two `server-only` modules touch Prisma directly: `lib/auth.ts` (Better
Auth adapter) and `lib/get-current-role.ts` (role for layout gates). (The
third `server-only` module, `lib/github-stats.ts`, calls the GitHub REST API
for landing-page stats, 1h revalidate — no DB.) Everything else must go
through the Nest API. Client components
import Prisma **types** only via `src/types/db.ts` (type-only re-export, keeps
the Prisma runtime out of the client bundle).

## Gotchas

- `next.config.ts`: `output: "standalone"`, `serverExternalPackages` for
  prisma/pg/better-auth, `transpilePackages: ["@buzrr/prisma"]`, remote
  images allowed from any https host.
- Two sources of "players in the room" exist for hosts: the REST lobby
  snapshot (React Query) and the live roster (`playersSlice` fed by
  `useAdminSocket`, plus `game.players` from sync). When touching rosters,
  check all three stay coherent.
- Mid-game, the live `game` slice is the only truth. The REST lobby payload
  describes the _room_, not the play state — don't reach for it to answer
  "which question are we on?", and don't reintroduce a mirror of that in
  `playersSlice`, which now holds the roster and nothing else.
- **New Redux slices are persisted by default** — the redux-persist config
  blacklists only `game`. Anything server-derived or per-session you add must
  be blacklisted too, or it resurrects on reload.
- **REST payload types are hand-written mirrors**, not imports: each
  `lib/modules/<domain>/api.ts` re-declares the server's response shapes
  (e.g. `GameResult`, `AdminLobbyPayload`). Changing a server response means
  updating the mirror by hand — nothing will error until runtime.
- Naming traps: the lobby roster slice registers as `state.player` (file
  `state/admin/playersSlice.ts`) — distinct from the live `state.game.players`;
  and `/admin/quiz/leaderboard/[roomId]`'s param is actually a **GameResult
  id** (`LeaderboardView` feeds it to `useResultQuery`), not a room id.
- Admin route-group chrome: `(mains)` and `(privileged)` wrap children in
  `AdminShell` (navbar shell); `(gameplay)` and `(quiz)` don't — pick the
  group accordingly when adding an admin page.
