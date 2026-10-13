import type { Faq } from "@/lib/seo/json-ld";
import { PLAN_FACTS, type FeatureId } from "./product";
import type { UseCaseSlug } from "./use-cases";

/**
 * Competitor facts for the alternative and comparison pages.
 *
 * The two page types have different jobs and must not repeat each other:
 * - `/alternatives/{slug}` answers "open-source / free {X} alternative": why
 *   people switch, who Buzrr suits, and when {X} is the better fit.
 * - `/compare/buzrr-vs-{slug}` answers "Buzrr vs {X}": the feature and
 *   pricing table, what each product is, and sources.
 *
 * Rules for editing this file:
 * - Every competitor claim cites an entry in that competitor's `sources`.
 * - Anything not confirmed in a cited public source is `unverified`, never a
 *   guessed "no". The only "no" cells are open source, self-hosting and
 *   offline/LAN use, which follow from every service listed here being a
 *   proprietary cloud service.
 * - No competitor prices or plan numbers: they vary by region and account
 *   type and change often. Say what plans exist and link the official page.
 * - FAQ answers are rendered on the page and emitted as FAQPage JSON-LD, so
 *   they follow the same rules as the table.
 * - Re-check sources and bump `FACTS_CHECKED` when you edit.
 */
export const FACTS_CHECKED = "October 2026";
/** Year shown in comparison titles; follows `FACTS_CHECKED`. */
export const FACTS_YEAR = FACTS_CHECKED.slice(-4);

export type CompetitorSlug =
  | "kahoot"
  | "slido"
  | "mentimeter"
  | "quizizz"
  | "wayground"
  | "quizup";

export type CellStatus = "yes" | "no" | "partial" | "unverified" | "info";

export interface Cell {
  status: CellStatus;
  text: string;
  /** Index into the competitor's `sources`. */
  source?: number;
}

export type RowId =
  | "pricing"
  | "freeLimits"
  | "openSource"
  | "selfHost"
  | "offline"
  | "join"
  | "aiQuiz"
  | "aiDocuments"
  | "oneVsOne"
  | "liveQuiz"
  | "scoring"
  | "selfPaced"
  | "questionTypes"
  | "audienceTools"
  | "integrations";

export const ROW_LABELS: Record<RowId, string> = {
  pricing: "Pricing",
  freeLimits: "Free plan limits",
  openSource: "Open source",
  selfHost: "Self-hosting",
  offline: "Offline / LAN use",
  join: "Players join without an account",
  aiQuiz: "AI quiz generation",
  aiDocuments: "Questions from your documents",
  oneVsOne: "1v1 duels / ranked play",
  liveQuiz: "Live hosted quizzes",
  scoring: "Speed-based scoring",
  selfPaced: "Self-paced / homework mode",
  questionTypes: "Question types",
  audienceTools: "Polls, Q&A, word clouds",
  integrations: "Presentation / LMS integrations",
};

/** Every comparison page shows the same rows, in this order. */
export const COMPARE_ROWS: RowId[] = [
  "pricing",
  "freeLimits",
  "openSource",
  "selfHost",
  "offline",
  "join",
  "aiQuiz",
  "aiDocuments",
  "oneVsOne",
  "liveQuiz",
  "scoring",
  "selfPaced",
  "questionTypes",
  "audienceTools",
  "integrations",
];

/** Buzrr's column — verified against this repository. */
export const BUZRR_CELLS: Record<RowId, Cell> = {
  pricing: {
    status: "info",
    text: "Free plan; optional Pro subscription; free to self-host",
  },
  freeLimits: {
    status: "info",
    text: `${PLAN_FACTS.freePlayers} players per room, ${PLAN_FACTS.freeQuizzes} quizzes, ${PLAN_FACTS.freeAi} AI generations; self-hosted instances get Pro limits`,
  },
  openSource: { status: "yes", text: "Yes — AGPL-3.0, full source on GitHub" },
  selfHost: {
    status: "yes",
    text: "Yes — one docker compose up (Next.js, NestJS, PostgreSQL, Redis)",
  },
  offline: {
    status: "yes",
    text: "Yes, self-hosted — runs on a local network with local accounts, local storage and an optional local AI model",
  },
  join: {
    status: "yes",
    text: "Yes — 6-character code, join link or QR; players never sign up",
  },
  aiQuiz: {
    status: "yes",
    text: "Yes — up to 15 questions from a topic description",
  },
  aiDocuments: {
    status: "yes",
    text: "Yes — PDF, DOCX, TXT, Markdown; questions cite their source passage",
  },
  oneVsOne: {
    status: "yes",
    text: "Ranked 1v1 battles with ELO matchmaking, plus unrated friend invites",
  },
  liveQuiz: {
    status: "yes",
    text: "Yes — host-paced rooms with answer charts and a running leaderboard",
  },
  scoring: {
    status: "yes",
    text: "1,000 points for an instant correct answer, down to 100 at the time limit",
  },
  selfPaced: { status: "no", text: "No — live play only" },
  questionTypes: {
    status: "partial",
    text: "Multiple choice, one correct answer, optional image",
  },
  audienceTools: { status: "no", text: "No — quizzes only" },
  integrations: { status: "no", text: "None" },
};

export interface Source {
  label: string;
  href: string;
}

export interface Competitor {
  slug: CompetitorSlug;
  name: string;
  /** How the product is referred to in headings, e.g. "Quizizz (now Wayground)". */
  displayName: string;
  /** The name as people type it into search: "Kahoot", not "Kahoot!". */
  searchName: string;
  /** One factual sentence about the competitor, with a source. */
  summary: Cell;
  sources: Source[];
  cells: Partial<Record<RowId, Cell>>;
  alternative: {
    /** One line for link cards on other pages. */
    teaser: string;
    title: string;
    description: string;
    h1: string;
    /** The direct answer the page opens with: one or two sentences. */
    lead: string;
    whyLook: { heading: string; points: { title: string; text: string }[] };
    differences: { heading: string; points: { title: string; text: string }[] };
    /** Buzrr features most relevant to people leaving this tool. */
    features: FeatureId[];
    goodFit: string[];
    stayWith: string[];
    useCases: UseCaseSlug[];
    related: CompetitorSlug[];
    faq: Faq[];
  };
  compare?: {
    teaser: string;
    description: string;
    /** The direct answer the page opens with: one or two sentences. */
    lead: string;
    /** What each product is, and where they overlap. */
    overview: string[];
    faq: Faq[];
    useCases: UseCaseSlug[];
  };
}

const UNVERIFIED = (name: string): Cell => ({
  status: "unverified",
  text: `Not verified — see ${name}'s documentation`,
});

const PROPRIETARY: Cell = {
  status: "no",
  text: "No — proprietary; source code is not published",
};
const CLOUD_ONLY: Cell = { status: "no", text: "No — cloud service only" };
const ONLINE_ONLY: Cell = {
  status: "no",
  text: "No — cloud service; players need internet access",
};

/** Comparison page title; Buzrr leads it, so no `| Buzrr` suffix. */
export const compareTitle = (c: Competitor) =>
  `Buzrr vs ${c.searchName}: Feature & Pricing Comparison (${FACTS_YEAR})`;

/** Quizizz and Wayground are one product, so they share sources and cells. */
const WAYGROUND_SOURCES: Source[] = [
  { label: "Wayground home page", href: "https://wayground.com" },
  {
    label: "THE Journal: Quizizz Rebrands as Wayground (June 2025)",
    href: "https://thejournal.com/Articles/2025/06/24/Quizizz-Rebrands-as-Wayground-Announces-New-AI-Features.aspx",
  },
];

const WAYGROUND_CELLS: Partial<Record<RowId, Cell>> = {
  pricing: {
    status: "info",
    text: "Free sign-up for teachers; schools and districts get a quote",
    source: 0,
  },
  freeLimits: {
    status: "unverified",
    text: "Not stated on Wayground's home page — see its plans",
    source: 0,
  },
  openSource: PROPRIETARY,
  selfHost: CLOUD_ONLY,
  offline: ONLINE_ONLY,
  join: {
    status: "unverified",
    text: "Players enter a code; whether they need an account isn't stated",
    source: 0,
  },
  aiQuiz: {
    status: "yes",
    text: "Yes — AI Question Generator; full activities from a topic or standard",
    source: 0,
  },
  aiDocuments: {
    status: "yes",
    text: "Yes — activities generated from a doc or upload",
    source: 0,
  },
  oneVsOne: UNVERIFIED("Wayground"),
  liveQuiz: {
    status: "yes",
    text: "Yes — assessments can run as a competitive game",
    source: 0,
  },
  scoring: UNVERIFIED("Wayground"),
  selfPaced: {
    status: "yes",
    text: "Yes — auto-graded homework and practice",
    source: 0,
  },
  questionTypes: UNVERIFIED("Wayground"),
  audienceTools: {
    status: "partial",
    text: "Interactive presentations with comprehension checks",
    source: 0,
  },
  integrations: {
    status: "yes",
    text: "LMS, rostering and SSO",
    source: 0,
  },
};

/**
 * The rebrand note shown on both Quizizz pages, linking to the Wayground
 * pages. Each sentence is backed by `WAYGROUND_SOURCES`.
 *
 * TODO(source): whether existing Quizizz accounts, quizzes and join links
 * carried over to Wayground unchanged. Add it here only with a citation.
 */
export const QUIZIZZ_REBRAND = {
  heading: "Quizizz is now Wayground",
  paragraphs: [
    "Quizizz rebranded as Wayground in June 2025 and announced new AI features with the change. The product now lives at wayground.com, whose home page is titled “Quizizz is now Wayground”; the company behind it still trades as Quizizz Inc.",
    "Wayground is wider than the quiz game Quizizz was known for: it covers assessments, homework, interactive presentations, AI tools, accommodations and LMS integration.",
  ],
};

export const COMPETITORS: Record<CompetitorSlug, Competitor> = {
  kahoot: {
    slug: "kahoot",
    name: "Kahoot!",
    displayName: "Kahoot!",
    searchName: "Kahoot",
    summary: {
      status: "info",
      text: "Kahoot! describes itself as a game-based learning platform for creating, sharing and playing learning games and trivia quizzes, used by schools, businesses and at home.",
      source: 0,
    },
    sources: [
      { label: "What is Kahoot!", href: "https://kahoot.com/what-is-kahoot/" },
      { label: "Kahoot! plans", href: "https://kahoot.com/pricing/" },
      {
        label: "Kahoot! help: How to join a Kahoot! game",
        href: "https://support.kahoot.com/hc/articles/360039890713",
      },
      {
        label: "Kahoot! help: How to generate a kahoot with AI",
        href: "https://support.kahoot.com/hc/en-us/articles/40803785990675",
      },
    ],
    cells: {
      pricing: {
        status: "info",
        text: "Free account available; paid plans for school, work and home",
        source: 1,
      },
      freeLimits: {
        status: "unverified",
        text: "Not stated on the plans page — paid tiers list participant caps per kahoot",
        source: 1,
      },
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      offline: ONLINE_ONLY,
      join: {
        status: "yes",
        text: "Yes — game PIN, link or QR; an account is only needed if the host turns on a player identifier",
        source: 2,
      },
      aiQuiz: {
        status: "yes",
        text: "Yes — AI generator builds a kahoot from a topic",
        source: 3,
      },
      aiDocuments: {
        status: "yes",
        text: "Yes — PDF-to-kahoot generator; page allowance depends on plan",
        source: 3,
      },
      oneVsOne: UNVERIFIED("Kahoot!"),
      liveQuiz: {
        status: "yes",
        text: "Yes — questions on a shared screen, answers on players' devices",
        source: 0,
      },
      scoring: UNVERIFIED("Kahoot!"),
      selfPaced: {
        status: "yes",
        text: "Yes — self-paced challenges, e.g. for homework",
        source: 0,
      },
      questionTypes: {
        status: "info",
        text: "Questions can include images, videos and diagrams",
        source: 0,
      },
      audienceTools: UNVERIFIED("Kahoot!"),
      integrations: UNVERIFIED("Kahoot!"),
    },
    alternative: {
      teaser:
        "Live rooms with a code, speed scoring and leaderboards — open source, self-hostable, plus ranked 1v1 battles.",
      title: "Open-Source Kahoot Alternative (Free, Self-Hostable)",
      description:
        "Buzrr is a free, open-source Kahoot alternative you can self-host: live quiz rooms joined by code or QR, speed scoring, AI questions and ranked 1v1 battles.",
      h1: "Open-source Kahoot alternative: free and self-hostable",
      lead: "Yes — Buzrr is a free, open-source Kahoot alternative: a host screen, a room code, and everyone answering on their phones against the clock. Its code is public under AGPL-3.0, so you can also run it on your own server.",
      whyLook: {
        heading: "Why people look for a Kahoot alternative",
        points: [
          {
            title: "They want the code",
            text: "Kahoot! is a closed, hosted product. Schools, universities and companies that need to audit a tool, keep data on their own infrastructure or adapt it to their needs can't do that with a proprietary service.",
          },
          {
            title: "They want a free tier that fits",
            text: "Plan limits and features differ by account type and region. People who only need a simple live multiple-choice game often look for something with a free plan that covers it.",
          },
          {
            title: "They want something between classes and game night",
            text: "Kahoot! targets schools, business and home separately. Buzrr has one product: the same account hosts a lesson review on Monday and a trivia night on Friday.",
          },
        ],
      },
      differences: {
        heading: "What you get by switching to Buzrr",
        points: [
          {
            title: "Your own instance",
            text: "Buzrr's web app, game server and AI service are on GitHub under AGPL-3.0. Self-hosted instances run with billing off and Pro limits.",
          },
          {
            title: "Ranked 1v1 quiz battles",
            text: "Beyond hosted rooms, signed-in players can queue for seven-question 1v1 battles matched by ELO rating, or invite a friend to an unrated match.",
          },
          {
            title: "Cited AI questions",
            text: "Upload PDFs, Word documents, text or Markdown to an AI Knowledge Space and generate questions that cite the passage they came from.",
          },
          {
            title: "Questions on every player's screen",
            text: "Players see the question text, image and options on their own device, so the game still works when people can't see the projector.",
          },
        ],
      },
      features: [
        "liveRooms",
        "guestPlayers",
        "speedScoring",
        "duels",
        "knowledgeSpaces",
        "aiQuiz",
        "liveResults",
        "rejoin",
        "images",
      ],
      goodFit: [
        "You run live multiple-choice quizzes and don't need other question formats.",
        "You want to read, audit or self-host the software.",
        "You like the idea of ranked 1v1 play alongside hosted rooms.",
        "You want to generate questions from your own documents with citations.",
      ],
      stayWith: [
        "You rely on self-paced challenges or homework assignments — Buzrr is live only.",
        "You need question types beyond single-answer multiple choice.",
        "You need video in questions — Buzrr supports images only.",
        "You want an established product with a large existing content library.",
      ],
      useCases: ["classroom-quizzes", "team-building", "corporate-training"],
      related: ["quizizz", "wayground", "slido", "mentimeter", "quizup"],
      faq: [
        {
          question: "Is there an open-source alternative to Kahoot?",
          answer:
            "Yes. Buzrr is an open-source live quiz platform under the AGPL-3.0 license. Like Kahoot!, a host shows questions on a big screen while players answer on their own devices after joining with a code, and faster correct answers score more.",
        },
        {
          question: "Can I self-host a Kahoot-style quiz?",
          answer:
            "Yes, with Buzrr. One docker compose up runs the whole stack — web app, game server, PostgreSQL and Redis — on your own machine or server, with billing off and Pro limits.",
        },
        {
          question: "Is Buzrr free?",
          answer: `Yes. The hosted free plan has no time limit and allows rooms of ${PLAN_FACTS.freePlayers} players; Buzrr Pro raises the limits. Self-hosting is free.`,
        },
        {
          question: "What can't Buzrr do that Kahoot! can?",
          answer:
            "Buzrr has no self-paced or homework mode, no video in questions, and only single-answer multiple-choice questions. If you rely on those, Kahoot! is the better fit.",
        },
      ],
    },
    compare: {
      teaser:
        "Pricing, free limits, self-hosting, offline use, joining, AI and 1v1 play side by side.",
      description:
        "Buzrr vs Kahoot! compared row by row: pricing and free plan, open source, self-hosting, offline/LAN use, no-account join, AI generation and 1v1 duels — with sources.",
      lead: "Buzrr and Kahoot! both run live quiz games joined with a code, and both generate questions with AI. The difference is ownership: Kahoot! is a proprietary cloud service, while Buzrr is open source and can run on your own server, even offline.",
      overview: [
        "Kahoot! is a game-based learning platform with separate products for school, work and home, a self-paced challenge mode, and AI tools that build kahoots from a topic or a PDF.",
        "Buzrr is a live quiz game with ranked 1v1 battles added. It is smaller in scope, and every part of it — including the AI service — is open source.",
      ],
      faq: [
        {
          question: "Is Buzrr cheaper than Kahoot!?",
          answer:
            "Both have a free option. Kahoot!'s paid plans vary by audience and region, so check its pricing page. Buzrr's free plan has no time limit, and a self-hosted Buzrr costs only your server.",
        },
        {
          question: "Do players need an account in Buzrr or Kahoot!?",
          answer:
            "In neither by default. Buzrr players join with a code, link or QR and never sign up. Kahoot!'s help center says players need an account only if the host turns on a player identifier.",
        },
        {
          question: "Can Buzrr or Kahoot! run without internet?",
          answer:
            "A self-hosted Buzrr runs on a local network with local accounts, local storage and an optional local AI model. Kahoot! is a cloud service, so players need internet access.",
        },
      ],
      useCases: ["classroom-quizzes", "team-building", "corporate-training"],
    },
  },

  quizizz: {
    slug: "quizizz",
    name: "Quizizz",
    displayName: "Quizizz (now Wayground)",
    searchName: "Quizizz",
    summary: {
      status: "info",
      text: "Quizizz was a game-based quiz tool for classrooms. It rebranded as Wayground in June 2025.",
      source: 1,
    },
    sources: WAYGROUND_SOURCES,
    cells: WAYGROUND_CELLS,
    alternative: {
      teaser:
        "For people who used Quizizz for its live quiz game, now that it has become Wayground.",
      title: "Open-Source Quizizz Alternative (Free, Self-Hostable)",
      description:
        "Quizizz is now Wayground. If you used it for live quiz games, Buzrr is a free, open-source, self-hostable alternative with code join, speed scoring and AI questions.",
      h1: "Open-source Quizizz alternative: free and self-hostable",
      lead: "If you used Quizizz for its live quiz games, Buzrr is a free, open-source alternative focused on exactly that. Quizizz itself is now Wayground, a much broader teaching platform.",
      whyLook: {
        heading: "Why people look for a Quizizz alternative",
        points: [
          {
            title: "The product changed name and shape",
            text: "Quizizz became Wayground in 2025 and grew into an instructional platform. People who only ran quiz games are looking for the simple tool they remember.",
          },
          {
            title: "It's not only for school",
            text: "Wayground is built for teachers and districts. Buzrr works the same for classrooms, fests, trivia nights and team socials.",
          },
          {
            title: "Open source matters",
            text: "Quizizz was, and Wayground is, a proprietary cloud platform. Buzrr's code is public and can be self-hosted.",
          },
        ],
      },
      differences: {
        heading: "What you get by switching to Buzrr",
        points: [
          {
            title: "Just the live game",
            text: "A Buzrr room moves when the host clicks Next, with an answer chart and running leaderboard between questions — built for a room playing together.",
          },
          {
            title: "Ranked 1v1 battles",
            text: "Students or friends with accounts can play seven-question ranked duels with ELO matchmaking, outside any lesson.",
          },
          {
            title: "Your own server",
            text: "Schools or clubs can run their own Buzrr instance under AGPL-3.0.",
          },
        ],
      },
      features: [
        "liveRooms",
        "liveResults",
        "guestPlayers",
        "speedScoring",
        "aiQuiz",
        "duels",
        "roomControls",
        "images",
        "selfHost",
      ],
      goodFit: [
        "You mostly ran live Quizizz games and want something focused on that.",
        "You also host quizzes outside the classroom.",
        "You want an open-source tool.",
      ],
      stayWith: [
        "You assign self-paced homework or practice — Buzrr is live only.",
        "You need LMS, rostering or SSO integration.",
        "You need question types beyond single-answer multiple choice.",
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
      related: ["wayground", "kahoot", "mentimeter", "slido"],
      faq: [
        {
          question: "Is Quizizz still called Quizizz?",
          answer:
            "No. Quizizz rebranded as Wayground in June 2025, and the product now lives at wayground.com.",
        },
        {
          question:
            "What is a free alternative to Quizizz for live quiz games?",
          answer: `Buzrr. Hosts build or AI-generate a multiple-choice quiz, players join with a code, link or QR without an account, and faster correct answers score more. The free plan allows rooms of ${PLAN_FACTS.freePlayers} players, and self-hosting is free.`,
        },
        {
          question: "Does Buzrr have Quizizz-style homework mode?",
          answer:
            "No. Buzrr is live play only. For self-paced homework, Wayground (formerly Quizizz) or Kahoot!'s challenges fit better.",
        },
      ],
    },
    compare: {
      teaser:
        "Quizizz, now Wayground, against Buzrr: pricing, free limits, self-hosting, AI and 1v1 play.",
      description:
        "Buzrr vs Quizizz (now Wayground) compared: pricing, free plan, open source, self-hosting, offline use, no-account join, AI generation and 1v1 duels, with sources.",
      lead: "Quizizz is now Wayground, an instructional platform for schools; Buzrr is an open-source live quiz game. They overlap on the live quiz, and Wayground adds homework, presentations and LMS integration around it.",
      overview: [
        "Wayground (formerly Quizizz) covers activities, assessments, homework, interactive presentations and AI tools for teachers and districts.",
        "Buzrr does live quiz games and ranked 1v1 battles, for classrooms and everywhere else, and its code is open source.",
      ],
      faq: [
        {
          question: "Is Buzrr vs Quizizz the same as Buzrr vs Wayground?",
          answer:
            "Yes. Quizizz rebranded as Wayground in June 2025, so the facts in this table are Wayground's. The Buzrr vs Wayground page compares the same rows for people who know the new name.",
        },
        {
          question: "Can Quizizz/Wayground be self-hosted?",
          answer:
            "No, it is a cloud service. Buzrr can be self-hosted with one docker compose up, including on a network with no internet access.",
        },
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
    },
  },

  wayground: {
    slug: "wayground",
    name: "Wayground",
    displayName: "Wayground",
    searchName: "Wayground",
    summary: {
      status: "info",
      text: "Wayground, formerly Quizizz, is an instructional platform with assessments, homework, interactive presentations, AI tools, accommodations and LMS integration.",
      source: 0,
    },
    sources: WAYGROUND_SOURCES,
    cells: WAYGROUND_CELLS,
    alternative: {
      teaser:
        "A focused, open-source live quiz game instead of a full teaching platform.",
      title: "Open-Source Wayground Alternative (Free, Self-Hostable)",
      description:
        "Buzrr is a free, open-source Wayground alternative for live quiz games: code or QR join without accounts, speed scoring, cited AI questions and self-hosting.",
      h1: "Open-source Wayground alternative: free and self-hostable",
      lead: "Buzrr is a free, open-source alternative to Wayground for the live quiz game: players join with a code, answer against the clock and climb a leaderboard. It skips the rest of Wayground's teaching platform, and you can self-host it.",
      whyLook: {
        heading: "Why people look for a Wayground alternative",
        points: [
          {
            title: "They only need the game",
            text: "Wayground describes itself as a place for activities, assessments, presentations, videos and flashcards. If a live quiz is all you run, a focused tool is simpler to set up.",
          },
          {
            title: "They need to keep data in-house",
            text: "Wayground is a cloud platform. Schools and clubs that need to run software on their own servers can't do that with it.",
          },
          {
            title: "They quiz outside school too",
            text: "Wayground is built for teachers and districts. Buzrr works the same for fests, trivia nights and team socials.",
          },
        ],
      },
      differences: {
        heading: "What you get by switching to Buzrr",
        points: [
          {
            title: "Open source and offline-capable",
            text: "AGPL-3.0 on GitHub. A self-hosted instance runs on a local network with local accounts, local storage and an optional local AI model.",
          },
          {
            title: "Cited AI questions",
            text: "Upload notes or a chapter PDF to a Knowledge Space; every generated question links back to the passage it came from.",
          },
          {
            title: "Ranked 1v1 battles",
            text: "Signed-in players can play seven-question duels matched by ELO rating, or challenge a friend with a link.",
          },
        ],
      },
      features: [
        "liveRooms",
        "guestPlayers",
        "knowledgeSpaces",
        "aiQuiz",
        "duels",
        "liveResults",
        "selfHost",
        "openSource",
        "browser",
      ],
      goodFit: [
        "Your Wayground use is mostly live quiz games.",
        "You need to self-host, or run quizzes on a network without internet.",
        "You want AI questions that cite your own material.",
      ],
      stayWith: [
        "You assign auto-graded homework and practice.",
        "You need LMS, rostering or SSO integration, or district reporting.",
        "You rely on accommodations or interactive presentations.",
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
      related: ["quizizz", "kahoot", "mentimeter", "slido"],
      faq: [
        {
          question: "Is Wayground the same as Quizizz?",
          answer:
            "Yes. Quizizz rebranded as Wayground in June 2025, and the product moved to wayground.com.",
        },
        {
          question: "Is there an open-source alternative to Wayground?",
          answer:
            "For live quiz games, Buzrr. It is AGPL-3.0 open source and self-hostable. It does not replace Wayground's homework, presentations, accommodations or LMS features.",
        },
        {
          question: "Can students join Buzrr without an account?",
          answer:
            "Yes. Players join with a 6-character code, a link or a QR code and pick a name. Only hosts sign in.",
        },
      ],
    },
    compare: {
      teaser:
        "Pricing, free limits, self-hosting, offline use, joining, AI and 1v1 play side by side.",
      description:
        "Buzrr vs Wayground (formerly Quizizz) compared: pricing, free plan, open source, self-hosting, offline/LAN use, no-account join, AI generation and 1v1 duels.",
      lead: "Wayground is a proprietary teaching platform with homework, presentations and AI tools; Buzrr is an open-source live quiz game you can self-host. Both generate questions with AI, including from your own documents.",
      overview: [
        "Wayground, formerly Quizizz, is sold to teachers (free sign-up) and to schools and districts (by quote), and covers assessment, homework and classroom workflow.",
        "Buzrr does live quiz rooms and ranked 1v1 battles. It has a free hosted plan, an optional Pro plan, and a free self-hosted option.",
      ],
      faq: [
        {
          question: "Does Wayground have a free plan?",
          answer:
            "Wayground's home page offers teachers a free sign-up and schools and districts a quote. Its free-tier limits aren't stated there, so check its plans page.",
        },
        {
          question: "Do both tools generate questions from documents?",
          answer:
            "Yes. Wayground generates activities from a doc or upload. Buzrr generates questions from PDF, DOCX, TXT or Markdown files and cites the source passage for each.",
        },
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
    },
  },

  slido: {
    slug: "slido",
    name: "Slido",
    displayName: "Slido",
    searchName: "Slido",
    summary: {
      status: "info",
      text: "Slido is an audience interaction tool — live polls, Q&A, quizzes and surveys — that is now part of Webex by Cisco and integrates with PowerPoint, Google Slides, Webex, Zoom and Microsoft Teams.",
      source: 0,
    },
    sources: [
      { label: "Slido features", href: "https://www.slido.com/features" },
      { label: "Slido pricing", href: "https://www.slido.com/pricing" },
      {
        label: "Slido community: How can I join Slido as a participant?",
        href: "https://community.sli.do/articles/483",
      },
    ],
    cells: {
      pricing: {
        status: "info",
        text: "One-time, annual, education and enterprise plans",
        source: 1,
      },
      freeLimits: {
        status: "unverified",
        text: "Not stated on the pricing page",
        source: 1,
      },
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      offline: ONLINE_ONLY,
      join: {
        status: "yes",
        text: "Yes — event code, link or QR; no sign-up unless the host requires email",
        source: 2,
      },
      aiQuiz: {
        status: "partial",
        text: "Slido AI suggests poll questions and wording; quiz generation not confirmed",
        source: 1,
      },
      aiDocuments: UNVERIFIED("Slido"),
      oneVsOne: {
        status: "unverified",
        text: "Not listed on Slido's features page",
        source: 0,
      },
      liveQuiz: {
        status: "yes",
        text: "Yes — live quizzes with timers and leaderboards",
        source: 0,
      },
      scoring: UNVERIFIED("Slido"),
      selfPaced: {
        status: "partial",
        text: "Surveys before, during or after a meeting",
        source: 0,
      },
      questionTypes: UNVERIFIED("Slido"),
      audienceTools: {
        status: "yes",
        text: "Yes — polls (multiple choice, word cloud, rating, open text, ranking) and live Q&A with upvotes",
        source: 0,
      },
      integrations: {
        status: "yes",
        text: "PowerPoint, Google Slides, Webex, Zoom, Microsoft Teams",
        source: 0,
      },
    },
    alternative: {
      teaser:
        "For Slido quiz, trivia and game sessions — not its Q&A or polls.",
      title: "Open-Source Slido Alternative for Quizzes, Trivia & Games",
      description:
        "Running a Slido quiz, trivia round or game? Buzrr is a free, open-source alternative built only for quiz games: speed scoring, leaderboards, AI questions, 1v1 battles.",
      h1: "Open-source Slido alternative for quizzes, trivia and games",
      lead: "If you use Slido for quizzes, trivia or games, Buzrr is a free, open-source alternative built only for that: speed scoring, a leaderboard after every question, and players on their own phones. It doesn't replace Slido's Q&A or polls.",
      whyLook: {
        heading: "When a Slido quiz isn't enough",
        points: [
          {
            title: "The quiz is the main event",
            text: "In Slido, a quiz is one interaction type among polls, Q&A and surveys. If your session is the game — a trivia night, a fest round, a revision game — a tool built around the game loop suits it better.",
          },
          {
            title: "You don't live in Webex, Zoom or PowerPoint",
            text: "Slido's strength is its integrations. If you just want a link and a QR code that works anywhere, you may not need them.",
          },
          {
            title: "You want to own the software",
            text: "Slido is a Cisco cloud service. Buzrr's code is public and can be self-hosted.",
          },
        ],
      },
      differences: {
        heading: "What Buzrr adds to quiz and trivia games",
        points: [
          {
            title: "Game-first scoring",
            text: "Every correct answer is worth up to 1,000 points, decaying to 100 at the time limit and measured on the server. The running leaderboard appears after every question.",
          },
          {
            title: "Players play on their own screen",
            text: "Each player sees the question, any image and the options on their phone, then whether they got it right. The final leaderboard shows up on every player's device too.",
          },
          {
            title: "Games outside the meeting",
            text: "Signed-in players can keep playing after the session in ranked 1v1 battles or friend challenges.",
          },
          {
            title: "Picture rounds",
            text: "Attach an image to any question — logos, maps, flags, photo rounds for trivia night.",
          },
        ],
      },
      features: [
        "liveRooms",
        "speedScoring",
        "liveResults",
        "guestPlayers",
        "images",
        "aiQuiz",
        "duels",
        "roomControls",
        "selfHost",
      ],
      goodFit: [
        "Your session is a quiz, trivia round or game with a winner.",
        "You don't need polls, word clouds or moderated Q&A.",
        "You want to self-host or audit the tool.",
      ],
      stayWith: [
        "You need audience Q&A with upvoting, or polls and word clouds.",
        "You run interactions inside PowerPoint, Google Slides, Webex, Zoom or Teams.",
        "Your sessions are meetings first and quizzes second.",
      ],
      useCases: ["pub-trivia", "live-audience-quizzes", "college-events"],
      related: ["mentimeter", "kahoot", "quizizz", "quizup"],
      faq: [
        {
          question: "Does Slido have quiz games?",
          answer:
            "Yes. Slido lists live quizzes with timers and leaderboards among its features, alongside polls, Q&A and surveys. Buzrr is an alternative for when the quiz is the whole session.",
        },
        {
          question: "Is Buzrr good for trivia nights?",
          answer:
            "Yes. Players join from their phones with a code or QR, image questions work for picture rounds, and the leaderboard updates after every question. Hosts can generate a draft quiz with AI.",
        },
        {
          question: "Can Buzrr replace Slido Q&A and polls?",
          answer:
            "No. Buzrr has no audience Q&A, polls, word clouds, surveys or presentation integrations. It replaces Slido only for quizzes and games.",
        },
      ],
    },
    compare: {
      teaser:
        "A quiz game against an audience-interaction suite: pricing, joining, AI, self-hosting.",
      description:
        "Buzrr vs Slido compared: pricing, free plan, open source, self-hosting, offline/LAN use, no-account join, AI generation and 1v1 duels, with sources.",
      lead: "Slido and Buzrr overlap on one feature — live quizzes — and differ on almost everything else. Slido is an audience interaction suite for meetings and events; Buzrr is an open-source quiz game platform you can self-host.",
      overview: [
        "Slido, part of Webex by Cisco, runs polls, Q&A, quizzes and surveys inside presentations and video calls.",
        "Buzrr does live quiz games and ranked 1v1 battles, in any browser, without integrations.",
      ],
      faq: [
        {
          question: "Do participants need an account to join Slido or Buzrr?",
          answer:
            "No, in both. Slido participants join with an event code, link or QR unless the host requires email. Buzrr players join with a code, link or QR and never sign up.",
        },
        {
          question: "Does Slido generate quizzes with AI?",
          answer:
            "Slido AI suggests poll questions and refines wording; we couldn't confirm AI quiz generation. Buzrr generates quizzes from a topic or from your documents.",
        },
      ],
      useCases: ["pub-trivia", "live-audience-quizzes", "corporate-training"],
    },
  },

  mentimeter: {
    slug: "mentimeter",
    name: "Mentimeter",
    displayName: "Mentimeter",
    searchName: "Mentimeter",
    summary: {
      status: "info",
      text: "Mentimeter is interactive presentation software. Its Quiz Competition slides sit inside a presentation; participants join at menti.com with a code, and a leaderboard slide shows the top 10.",
      source: 0,
    },
    sources: [
      {
        label: "Mentimeter: How to create a Quiz Competition",
        href: "https://help.mentimeter.com/en/articles/410463-how-to-create-a-quiz-competition",
      },
      {
        label: "Mentimeter: Participating in a Quiz Competition",
        href: "https://help.mentimeter.com/en/articles/2968253-participating-in-a-quiz-competition",
      },
      { label: "Mentimeter plans", href: "https://www.mentimeter.com/plans" },
      {
        label: "Mentimeter: How to use AI Creation",
        href: "https://help.mentimeter.com/en/articles/9061138-how-to-use-ai-creation",
      },
    ],
    cells: {
      pricing: {
        status: "info",
        text: "Free plan and paid plans",
        source: 2,
      },
      freeLimits: {
        status: "info",
        text: "Monthly participant and slide limits — see the plans page",
        source: 2,
      },
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      offline: ONLINE_ONLY,
      join: {
        status: "yes",
        text: "Yes — code at menti.com; no participant account",
        source: 1,
      },
      aiQuiz: {
        status: "yes",
        text: "Yes — AI Creation drafts quizzes from a prompt",
        source: 3,
      },
      aiDocuments: UNVERIFIED("Mentimeter"),
      oneVsOne: UNVERIFIED("Mentimeter"),
      liveQuiz: {
        status: "yes",
        text: "Yes — Quiz Competition slides inside a presentation",
        source: 0,
      },
      scoring: {
        status: "yes",
        text: "Optional time-based scoring, 1,000 to 500 points per correct answer",
        source: 0,
      },
      selfPaced: UNVERIFIED("Mentimeter"),
      questionTypes: {
        status: "yes",
        text: "Select Answer and Type Answer quiz slides",
        source: 0,
      },
      audienceTools: UNVERIFIED("Mentimeter"),
      integrations: UNVERIFIED("Mentimeter"),
    },
    alternative: {
      teaser:
        "A standalone quiz game instead of quiz slides inside a presentation.",
      title: "Open-Source Mentimeter Alternative (Free, Self-Hostable)",
      description:
        "Buzrr is a free, open-source Mentimeter alternative for quiz competitions: a standalone live quiz game with QR join, speed scoring, full leaderboards and self-hosting.",
      h1: "Open-source Mentimeter alternative: free and self-hostable",
      lead: "For quiz competitions, Buzrr is a free, open-source Mentimeter alternative: a standalone live quiz game rather than quiz slides inside a presentation. You can use the hosted version or run it on your own server.",
      whyLook: {
        heading: "Why look beyond Mentimeter for quizzes",
        points: [
          {
            title: "You're not giving a presentation",
            text: "Mentimeter's quiz lives inside a deck. If there are no content slides — just rounds of questions — a dedicated quiz tool keeps the setup simpler.",
          },
          {
            title: "You want every player ranked",
            text: "Mentimeter's leaderboard slide shows the top 10. Buzrr's leaderboard ranks every player, and the full final standings are saved to your history.",
          },
          {
            title: "You want to self-host",
            text: "Mentimeter is a cloud service. Buzrr is AGPL-3.0 open source.",
          },
        ],
      },
      differences: {
        heading: "What you get by switching to Buzrr",
        points: [
          {
            title: "A game, not a deck",
            text: "Build a quiz, click Host, and players join with a code, link or QR. The host screen moves between questions, answer charts and the running leaderboard.",
          },
          {
            title: "Wider speed scoring",
            text: "Buzrr's scores run from 1,000 for an instant correct answer down to 100 at the time limit, so speed separates players more.",
          },
          {
            title: "Life after the session",
            text: "Signed-in players can play ranked 1v1 quiz battles against each other any time.",
          },
        ],
      },
      features: [
        "liveRooms",
        "liveResults",
        "speedScoring",
        "knowledgeSpaces",
        "aiQuiz",
        "images",
        "duels",
        "openSource",
        "guestPlayers",
      ],
      goodFit: [
        "You run standalone quiz games rather than presentations.",
        "You want the full room ranked, not just a top 10.",
        "You want an open-source, self-hostable tool.",
      ],
      stayWith: [
        "You want quiz questions woven into a presentation with content slides.",
        "You need type-your-answer questions — Buzrr is multiple choice only.",
        "You use other interactive slide types alongside quizzes.",
      ],
      useCases: [
        "live-audience-quizzes",
        "classroom-quizzes",
        "corporate-training",
      ],
      related: ["slido", "kahoot", "quizizz", "quizup"],
      faq: [
        {
          question: "Is there an open-source alternative to Mentimeter?",
          answer:
            "For quiz competitions, yes: Buzrr is AGPL-3.0 open source and self-hostable. It is not presentation software, so it doesn't replace Mentimeter's content slides or other interactive slide types.",
        },
        {
          question: "Does Buzrr show the whole leaderboard?",
          answer:
            "Yes. Every player is ranked after each question and at the end, and the final standings are saved to the host's history.",
        },
        {
          question: "Can I use Buzrr inside my slides?",
          answer:
            "No. Buzrr runs as its own host screen in the browser; there is no PowerPoint or Google Slides integration.",
        },
      ],
    },
    compare: {
      teaser:
        "Pricing, free limits, joining, AI, self-hosting and offline use, with help-center sources.",
      description:
        "Buzrr vs Mentimeter for live quizzes: pricing and free plan, open source, self-hosting, offline/LAN use, no-account join, AI generation and 1v1 duels, with sources.",
      lead: "Mentimeter is presentation software with quiz slides; Buzrr is an open-source quiz game you can self-host. Both let an audience join with a code, without an account, and compete for points on speed.",
      overview: [
        "Mentimeter's Quiz Competition is a set of slides in a presentation, with Select Answer and Type Answer questions and a top-10 leaderboard slide.",
        "Buzrr is only a quiz game: its own host screen, player view and full leaderboard, plus ranked 1v1 battles.",
      ],
      faq: [
        {
          question: "How does Mentimeter's quiz scoring compare with Buzrr's?",
          answer:
            "Mentimeter's optional time-based scoring gives 1,000 to 500 points per correct answer. Buzrr gives 1,000 for an instant correct answer down to 100 at the time limit.",
        },
        {
          question: "Do both have a free plan?",
          answer: `Yes. Mentimeter's free plan has monthly participant and slide limits listed on its plans page. Buzrr's free plan has no time limit and allows rooms of up to ${PLAN_FACTS.freePlayers} players.`,
        },
      ],
      useCases: [
        "live-audience-quizzes",
        "classroom-quizzes",
        "corporate-training",
      ],
    },
  },

  quizup: {
    slug: "quizup",
    name: "QuizUp",
    displayName: "QuizUp",
    searchName: "QuizUp",
    summary: {
      status: "info",
      text: "QuizUp was a mobile trivia game where two players faced off in seven rounds of timed multiple-choice questions across more than 1,000 topics. Its servers went offline on 24 March 2021.",
      source: 0,
    },
    sources: [
      {
        label: "QuizUp — Wikipedia",
        href: "https://en.wikipedia.org/wiki/QuizUp",
      },
    ],
    cells: {},
    alternative: {
      teaser:
        "Ranked 1v1 battles of seven timed questions, in the browser — QuizUp shut down in 2021.",
      title: "QuizUp Alternative: Ranked 1v1 Quiz Battles",
      description:
        "QuizUp shut down in 2021. Buzrr has ranked 1v1 quiz battles in the browser: seven timed questions, ELO matchmaking and friend challenges. Open source.",
      h1: "A QuizUp alternative for 1v1 quiz battles",
      lead: "QuizUp went offline in March 2021. Buzrr's duel mode is the closest replacement we know how to build: you against one opponent, seven timed multiple-choice questions, speed counts.",
      whyLook: {
        heading: "What QuizUp players miss",
        points: [
          {
            title: "Head-to-head, right now",
            text: "QuizUp matched you against a real opponent for a short, timed match. There was always someone to play.",
          },
          {
            title: "A reason to keep playing",
            text: "Winning against better players, climbing, and challenging friends to a rematch.",
          },
          {
            title: "It's gone",
            text: "The app was removed from the App Store in January 2021 and its servers shut down on 24 March 2021.",
          },
        ],
      },
      differences: {
        heading: "How Buzrr's 1v1 battles work",
        points: [
          {
            title: "Seven questions, one opponent",
            text: "A duel is seven timed multiple-choice questions. Correct answers earn more the faster you are, and the higher total wins.",
          },
          {
            title: "ELO matchmaking",
            text: "Matchmade duels are rated. The matchmaker looks for someone near your rating and widens the search the longer you wait. If nobody suitable is queuing, you play a bot pitched at your level rather than waiting.",
          },
          {
            title: "Friend challenges",
            text: "Send an invite link for an unrated match against a friend.",
          },
          {
            title: "Browser, not app store",
            text: "Duels run in any modern browser. There's nothing to install — and because the code is open source, it can't disappear the way QuizUp did.",
          },
        ],
      },
      features: [
        "duels",
        "friendInvites",
        "speedScoring",
        "browser",
        "liveRooms",
        "openSource",
      ],
      goodFit: [
        "You miss quick head-to-head trivia matches.",
        "You want a rating that moves when you win or lose.",
        "You'd like to challenge friends with a link.",
      ],
      stayWith: [
        "Buzrr doesn't have QuizUp's 1,000+ topic categories: duel questions come from one shared pool of community quizzes approved by moderators.",
        "There are no native mobile apps, topic communities or social feed.",
      ],
      useCases: ["pub-trivia", "college-events", "team-building"],
      related: ["kahoot", "quizizz", "slido", "mentimeter"],
      faq: [
        {
          question: "Is there a QuizUp replacement?",
          answer:
            "QuizUp shut down in March 2021. Buzrr offers the same core loop: ranked 1v1 matches of seven timed multiple-choice questions with ELO matchmaking and friend invites, in the browser. It doesn't recreate QuizUp's topic categories or social features.",
        },
        {
          question: "Do I need an account for Buzrr duels?",
          answer:
            "Yes. Duels are rated, so your rating needs an account to live on. Hosted quiz rooms, by contrast, let players join without one.",
        },
      ],
    },
  },
};

/** QuizUp no longer exists, so its page compares match formats instead. */
export const QUIZUP_ROWS: { label: string; quizup: string; buzrr: string }[] = [
  {
    label: "Match format",
    quizup:
      "1v1, seven rounds of timed multiple-choice questions (six normal, one bonus)",
    buzrr: "1v1, seven timed multiple-choice questions",
  },
  {
    label: "Scoring",
    quizup: "Points for accuracy and speed, doubled in the bonus round",
    buzrr: "Up to 1,000 points per correct answer, decaying with time",
  },
  {
    label: "Topics",
    quizup: "Over 1,000 official categories plus user-created topics",
    buzrr: "One shared pool of moderator-approved community questions",
  },
  {
    label: "Opponents",
    quizup: "Friends or random opponents",
    buzrr:
      "ELO matchmaking with a bot fallback, or a friend via invite link (unrated)",
  },
  {
    label: "Platforms",
    quizup: "iOS, Android, Windows Phone",
    buzrr: "Any modern web browser",
  },
  {
    label: "Status",
    quizup: "Servers taken offline on 24 March 2021",
    buzrr: "Active and open source (AGPL-3.0)",
  },
];

export const COMPETITOR_SLUGS = Object.keys(COMPETITORS) as CompetitorSlug[];

/** Competitors with a /compare/buzrr-vs-{slug} page. */
export const COMPARE_SLUGS = COMPETITOR_SLUGS.filter(
  (slug) => COMPETITORS[slug].compare,
);

export const comparePath = (slug: CompetitorSlug) =>
  `/compare/buzrr-vs-${slug}`;
export const alternativePath = (slug: CompetitorSlug) =>
  `/alternatives/${slug}`;
