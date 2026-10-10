import type { IconType } from "react-icons";
import {
  LuBot,
  LuChartColumn,
  LuFileText,
  LuGithub,
  LuGlobe,
  LuImage,
  LuQrCode,
  LuRefreshCw,
  LuServer,
  LuShieldBan,
  LuSwords,
  LuTimer,
  LuUserPlus,
  LuUsers,
} from "react-icons/lu";
import { PLAN_COPY } from "@/lib/pricing";

/**
 * Verified facts about Buzrr for marketing pages. Every claim here is backed
 * by code — the file/constant is noted next to it. When the product changes,
 * change it here, and every SEO page follows.
 */

/** Standalone "What is Buzrr?" answer — must make sense with no context. */
export const WHAT_IS_BUZRR =
  "Buzrr is an open-source quiz platform that runs in the browser. A host builds a multiple-choice quiz — by hand or with AI — and opens a live room; players join from their own phones or laptops with a 6-character code, a link or a QR code, without creating an account. Signed-in users can also play ranked 1v1 quiz battles. Buzrr is licensed under AGPL-3.0, so anyone can read the code or run their own instance.";

export const FEATURES = {
  // game-sessions + realtime modules; ShareRoom.tsx (link + QR)
  liveRooms: {
    icon: LuQrCode,
    title: "Live hosted quiz rooms",
    text: "The host runs the room from one screen and moves it along question by question. Players join with a 6-character room code, a join link or a QR code.",
  },
  // Player/Setup/* — guest profile in localStorage (ADR-005)
  guestPlayers: {
    icon: LuUserPlus,
    title: "No accounts for players",
    text: "Players pick a name and an avatar and they are in. Only the host signs in (with Google).",
  },
  // common/utils/compute-score.ts
  speedScoring: {
    icon: LuTimer,
    title: "Speed-based scoring",
    text: "A correct answer earns up to 1,000 points, sliding to 100 at the time limit; wrong answers score 0. Answer time is measured on the server, not on the player's device.",
  },
  // Admin/Game/QuesResult.tsx (answer bars), Leaderboard.tsx, GameResult model
  liveResults: {
    icon: LuChartColumn,
    title: "Answer charts and leaderboards",
    text: "When a question closes, the host screen shows how the room answered alongside the running leaderboard. Final results — rank, score and correct answers per player — are saved to the host's history.",
  },
  // modules/duel — DUEL_QUESTION_COUNT = 7, ELO matchmaking, bot fallback
  duels: {
    icon: LuSwords,
    title: "Ranked 1v1 quiz battles",
    text: "Seven questions against one opponent, matched by ELO rating. If nobody near your rating is queuing, you get a bot opponent instead of an empty wait.",
  },
  // duel-invite.service.ts — rated: false
  friendInvites: {
    icon: LuUsers,
    title: "Challenge a friend",
    text: "Send an invite link for an unrated 1v1 match against someone you know.",
  },
  // quizzes/ai endpoint — CreateAIQuiz.tsx caps at 15 questions
  aiQuiz: {
    icon: LuBot,
    title: "AI quiz generation",
    text: "Describe a topic and Buzrr drafts up to 15 multiple-choice questions with Google Gemini. Edit anything before you host.",
  },
  // apps/ai — Knowledge Spaces, DocumentUploader.tsx accepts .pdf .docx .txt .md
  knowledgeSpaces: {
    icon: LuFileText,
    title: "Quizzes from your documents",
    text: "Upload PDF, DOCX, TXT or Markdown files to an AI Knowledge Space. Generated questions cite the passage they came from, and you export the ones you keep into a quiz.",
  },
  // AddQuesForm.tsx — image upload via Cloudinary
  images: {
    icon: LuImage,
    title: "Image questions",
    text: "Attach an image to a question — a diagram, a map, a logo, a photo round.",
  },
  // Admin/Lobby.tsx — kick + ban mutations
  roomControls: {
    icon: LuShieldBan,
    title: "Room controls",
    text: "Remove a player from the lobby or the live leaderboard, or ban them so they can't rejoin that room.",
  },
  // game-engine.service.ts — players keep their score and may rejoin
  rejoin: {
    icon: LuRefreshCw,
    title: "Reconnects keep scores",
    text: "If a player's connection drops mid-game, they can rejoin and keep their score.",
  },
  // LICENSE, README
  openSource: {
    icon: LuGithub,
    title: "Open source (AGPL-3.0)",
    text: "The full source — web app, game server and AI service — is public on GitHub.",
  },
  // README quick start; billing.config.ts (self-hosted = Pro limits)
  selfHost: {
    icon: LuServer,
    title: "Self-hostable",
    text: "Run your own instance on your own infrastructure. Self-hosted instances run with billing off and Pro limits.",
  },
  browser: {
    icon: LuGlobe,
    title: "Runs in the browser",
    text: "Nothing to install for hosts or players. It works on phones, tablets and laptops.",
  },
} satisfies Record<string, { icon: IconType; title: string; text: string }>;

export type FeatureId = keyof typeof FEATURES;

/** billing/plans.ts `PLAN_LIMITS`, mirrored by `PLAN_COPY`. */
export const PLAN_FACTS = {
  freePlayers: PLAN_COPY.free.maxPlayers,
  proPlayers: PLAN_COPY.pro.maxPlayers,
  freeQuizzes: PLAN_COPY.free.maxQuizzes,
  freeAi: PLAN_COPY.free.aiTokens,
  proAiPerWeek: PLAN_COPY.pro.aiTokensPerWeek,
};

/** Things Buzrr does not do. Stated plainly so pages never imply otherwise. */
export const LIMITATIONS = {
  questionTypes:
    "Questions are multiple choice with one correct answer. There are no polls, word clouds, open-text, type-an-answer or rating questions.",
  livePacing:
    "Hosted rooms are live only — there is no self-paced or homework mode.",
  noIntegrations:
    "There are no LMS, Slack, Teams, PowerPoint or Google Slides integrations.",
  guestResults:
    "Players are guests, so results are recorded against the nickname they typed, not a student or employee account.",
  googleLogin:
    "Hosts sign in with Google; that is currently the only sign-in method.",
};

/** The host → player flow, step by step (see docs/architecture/frontend.md). */
export const HOST_STEPS = [
  {
    title: "Build a quiz",
    text: "Sign in, create a quiz and add multiple-choice questions with a time limit each — or generate a draft with AI and edit it.",
  },
  {
    title: "Open a room",
    text: "Hit Host. Buzrr creates a room with a 6-character code, a join link and a QR code for the big screen.",
  },
  {
    title: "Players join",
    text: "Players open the link or enter the code on their own device, pick a name and avatar, and appear in your lobby.",
  },
  {
    title: "Play it live",
    text: "Start the game. Each question runs on a server-side timer and closes early once everyone has answered. The host screen then shows the answer chart and running leaderboard, and you move on when the room is ready.",
  },
  {
    title: "Keep the results",
    text: "The final leaderboard is saved to your history with each player's rank, score and correct answers.",
  },
];
