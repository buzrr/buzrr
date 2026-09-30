import type { FeatureId } from "./product";
import type { UseCaseSlug } from "./use-cases";

/**
 * Competitor facts for the alternative and comparison pages.
 *
 * Rules for editing this file:
 * - Every competitor claim cites an entry in that competitor's `sources`.
 * - Anything not confirmed in a cited public source is `unverified`, never a
 *   guessed "no". The only "no" cells are open source / self-hosting, which
 *   hold for every proprietary cloud service listed here.
 * - No competitor prices or plan limits: they vary by region and account type
 *   and change often. Link to the official pricing page instead.
 * - Re-check sources and bump `FACTS_CHECKED` when you edit.
 */
export const FACTS_CHECKED = "October 2026";

export type CompetitorSlug =
  | "kahoot"
  | "slido"
  | "mentimeter"
  | "quizizz"
  | "quizup";

export type CellStatus = "yes" | "no" | "partial" | "unverified" | "info";

export interface Cell {
  status: CellStatus;
  text: string;
  /** Index into the competitor's `sources`. */
  source?: number;
}

export type RowId =
  | "openSource"
  | "selfHost"
  | "liveQuiz"
  | "join"
  | "scoring"
  | "oneVsOne"
  | "aiQuiz"
  | "aiDocuments"
  | "selfPaced"
  | "questionTypes"
  | "audienceTools"
  | "integrations"
  | "pricing";

export const ROW_LABELS: Record<RowId, string> = {
  openSource: "Open source",
  selfHost: "Self-hosting",
  liveQuiz: "Live hosted quizzes",
  join: "How players join",
  scoring: "Speed-based scoring",
  oneVsOne: "1v1 / ranked play",
  aiQuiz: "AI quiz generation",
  aiDocuments: "Questions from your documents",
  selfPaced: "Self-paced / homework mode",
  questionTypes: "Question types",
  audienceTools: "Polls, Q&A, word clouds",
  integrations: "Presentation / LMS integrations",
  pricing: "Pricing",
};

/** Buzrr's column — verified against this repository. */
export const BUZRR_CELLS: Record<RowId, Cell> = {
  openSource: { status: "yes", text: "Yes — GPL-3.0, full source on GitHub" },
  selfHost: {
    status: "yes",
    text: "Yes — Next.js, NestJS, PostgreSQL and Redis",
  },
  liveQuiz: {
    status: "yes",
    text: "Yes — host-paced rooms with answer charts and a running leaderboard",
  },
  join: {
    status: "yes",
    text: "6-character code, join link or QR; no player account",
  },
  scoring: {
    status: "yes",
    text: "1,000 points for an instant correct answer, down to 100 at the time limit",
  },
  oneVsOne: {
    status: "yes",
    text: "Ranked 1v1 battles with ELO matchmaking, plus unrated friend invites",
  },
  aiQuiz: {
    status: "yes",
    text: "Yes — up to 15 questions from a topic description (Gemini)",
  },
  aiDocuments: {
    status: "yes",
    text: "Yes — PDF, DOCX, TXT, Markdown; questions cite their source passage",
  },
  selfPaced: { status: "no", text: "No — live play only" },
  questionTypes: {
    status: "partial",
    text: "Multiple choice, one correct answer, optional image",
  },
  audienceTools: { status: "no", text: "No — quizzes only" },
  integrations: { status: "no", text: "None" },
  pricing: {
    status: "info",
    text: "Free plan; optional Pro subscription; free to self-host",
  },
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
    lead: string;
    whyLook: { heading: string; points: { title: string; text: string }[] };
    differences: { heading: string; points: { title: string; text: string }[] };
    /** Buzrr features most relevant to people leaving this tool. */
    features: FeatureId[];
    /** The short table on the alternative page (full table on /compare). */
    keyRows: RowId[];
    goodFit: string[];
    stayWith: string[];
    useCases: UseCaseSlug[];
    related: CompetitorSlug[];
    /** Question/answer shown as plain text on the page (no FAQ schema). */
    answer: { question: string; text: string };
  };
  compare?: {
    teaser: string;
    title: string;
    description: string;
    h1: string;
    intro: string[];
    rows: RowId[];
    chooseBuzrr: string[];
    chooseCompetitor: string[];
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

export const COMPETITORS: Record<CompetitorSlug, Competitor> = {
  kahoot: {
    slug: "kahoot",
    name: "Kahoot!",
    displayName: "Kahoot!",
    summary: {
      status: "info",
      text: "Kahoot! describes itself as a game-based learning platform for creating, sharing and playing learning games and trivia quizzes, used by schools, businesses and at home.",
      source: 0,
    },
    sources: [
      { label: "What is Kahoot!", href: "https://kahoot.com/what-is-kahoot/" },
      { label: "Kahoot! plans", href: "https://kahoot.com/pricing/" },
    ],
    cells: {
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      liveQuiz: {
        status: "yes",
        text: "Yes — questions on a shared screen, answers on players' devices",
        source: 0,
      },
      join: { status: "yes", text: "Game PIN", source: 0 },
      scoring: UNVERIFIED("Kahoot!"),
      oneVsOne: UNVERIFIED("Kahoot!"),
      aiQuiz: UNVERIFIED("Kahoot!"),
      aiDocuments: UNVERIFIED("Kahoot!"),
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
      pricing: {
        status: "info",
        text: "Free and paid plans for school, work and home — see Kahoot!'s pricing page",
        source: 1,
      },
    },
    alternative: {
      teaser:
        "Live rooms with a code, speed scoring and leaderboards — open source, self-hostable, plus ranked 1v1 battles.",
      title: "Free, Open-Source Kahoot Alternative",
      description:
        "A free, open-source Kahoot alternative: live quiz rooms players join with a code or QR, AI quiz generation, ranked 1v1 battles, and self-hosting.",
      h1: "A free, open-source Kahoot alternative",
      lead: "Buzrr runs the same shape of game Kahoot! made popular — a host screen, a room code, everyone answering on their phones against the clock — in an app whose source code is public and which you can run on your own server.",
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
        heading: "What's actually different about Buzrr",
        points: [
          {
            title: "Open source and self-hostable",
            text: "Buzrr's web app, game server and AI service are on GitHub under GPL-3.0. Self-hosted instances run with billing off and Pro limits.",
          },
          {
            title: "Ranked 1v1 quiz battles",
            text: "Beyond hosted rooms, signed-in players can queue for seven-question 1v1 battles matched by ELO rating, or invite a friend to an unrated match.",
          },
          {
            title: "Questions from your own documents",
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
      keyRows: ["openSource", "selfHost", "join", "oneVsOne", "selfPaced"],
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
      ],
      useCases: ["classroom-quizzes", "team-building", "corporate-training"],
      related: ["quizizz", "slido", "mentimeter", "quizup"],
      answer: {
        question: "Is Buzrr a Kahoot alternative?",
        text: "Yes, for live hosted quizzes. Like Kahoot!, a host shows questions on a big screen while players answer on their own devices, joining with a code, and faster correct answers score more. Unlike Kahoot!, Buzrr is open source (GPL-3.0), can be self-hosted, and adds ranked 1v1 quiz battles. It does not have a self-paced mode or question types beyond multiple choice.",
      },
    },
    compare: {
      teaser:
        "Open source, self-hosting, joining, scoring, 1v1 play, AI and self-paced mode side by side.",
      title: "Buzrr vs Kahoot!: Feature Comparison",
      description:
        "Buzrr vs Kahoot! side by side: open source, self-hosting, live rooms, AI quiz generation, 1v1 play and self-paced mode — with sources for every claim.",
      h1: "Buzrr vs Kahoot!",
      intro: [
        "Both tools run live quiz games where a host shows questions and players answer from their own devices. The biggest structural difference is ownership: Kahoot! is a proprietary hosted service, while Buzrr is open source and can run on your own server.",
        "This table sticks to what we could verify. Buzrr's column comes from our own code. Kahoot!'s column cites Kahoot!'s public pages; where we couldn't confirm something, it says so instead of guessing.",
      ],
      rows: [
        "openSource",
        "selfHost",
        "liveQuiz",
        "join",
        "scoring",
        "oneVsOne",
        "aiQuiz",
        "aiDocuments",
        "selfPaced",
        "questionTypes",
        "pricing",
      ],
      chooseBuzrr: [
        "You want an open-source tool you can self-host or audit.",
        "You want ranked 1v1 quiz battles in the same app as hosted rooms.",
        "You want AI-generated questions that cite your own documents.",
      ],
      chooseCompetitor: [
        "You assign self-paced quizzes as homework or asynchronous training.",
        "You want video in questions or formats beyond single-answer multiple choice.",
        "You want an established product with a large existing content library.",
      ],
      useCases: ["classroom-quizzes", "team-building", "corporate-training"],
    },
  },

  slido: {
    slug: "slido",
    name: "Slido",
    displayName: "Slido",
    summary: {
      status: "info",
      text: "Slido is an audience interaction tool — live polls, Q&A, quizzes and surveys — that is now part of Webex by Cisco and integrates with PowerPoint, Google Slides, Webex, Zoom and Microsoft Teams.",
      source: 0,
    },
    sources: [
      { label: "Slido features", href: "https://www.slido.com/features" },
      { label: "Slido pricing", href: "https://www.slido.com/pricing" },
    ],
    cells: {
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      liveQuiz: {
        status: "yes",
        text: "Yes — live quizzes with timers and leaderboards",
        source: 0,
      },
      join: UNVERIFIED("Slido"),
      scoring: UNVERIFIED("Slido"),
      oneVsOne: {
        status: "unverified",
        text: "Not listed on Slido's features page",
        source: 0,
      },
      aiQuiz: UNVERIFIED("Slido"),
      aiDocuments: UNVERIFIED("Slido"),
      selfPaced: {
        status: "partial",
        text: "Surveys before, during or after a meeting",
        source: 0,
      },
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
      pricing: {
        status: "info",
        text: "Free and paid plans — see Slido's pricing page",
        source: 1,
      },
    },
    alternative: {
      teaser:
        "For sessions where the quiz is the main event, not one feature among polls and Q&A.",
      title: "Slido Alternative for Competitive Live Quizzes",
      description:
        "A Slido alternative for quiz competitions: open-source live quizzes with speed scoring, leaderboards, AI questions and 1v1 battles. No polls or Q&A.",
      h1: "A Slido alternative built for quiz games",
      lead: "Slido is built around the meeting: polls, audience Q&A and quizzes inside your slides and video calls. Buzrr only does one of those things — competitive live quizzes — and goes further with it.",
      whyLook: {
        heading: "When Slido isn't the right shape",
        points: [
          {
            title: "The quiz is the main event",
            text: "In Slido, a quiz is one interaction type among polls, Q&A and surveys. If your session is the quiz — a trivia night, a fest round, a revision game — a tool built around the game loop may suit it better.",
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
        heading: "How Buzrr differs from Slido",
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
            title: "Open source",
            text: "GPL-3.0 on GitHub, with a self-hosting path for teams that can't use a third-party cloud.",
          },
        ],
      },
      features: [
        "liveRooms",
        "speedScoring",
        "liveResults",
        "guestPlayers",
        "knowledgeSpaces",
        "duels",
        "roomControls",
        "selfHost",
        "browser",
      ],
      keyRows: [
        "openSource",
        "liveQuiz",
        "audienceTools",
        "integrations",
        "oneVsOne",
      ],
      goodFit: [
        "Your session is a quiz competition with a winner.",
        "You don't need polls, word clouds or moderated Q&A.",
        "You want to self-host or audit the tool.",
      ],
      stayWith: [
        "You need audience Q&A with upvoting, or polls and word clouds.",
        "You run interactions inside PowerPoint, Google Slides, Webex, Zoom or Teams.",
        "Your sessions are meetings first and quizzes second.",
      ],
      useCases: [
        "live-audience-quizzes",
        "corporate-training",
        "college-events",
      ],
      related: ["mentimeter", "kahoot", "quizizz", "quizup"],
      answer: {
        question: "Can Buzrr replace Slido?",
        text: "Only for quizzes. Buzrr runs competitive live quizzes with speed scoring and leaderboards, and is open source. It has no audience Q&A, polls, word clouds, surveys or presentation integrations, which are Slido's core features.",
      },
    },
    compare: {
      teaser:
        "Quizzes vs a full audience-interaction suite: polls, Q&A, integrations, scoring.",
      title: "Buzrr vs Slido: Live Quiz Tool Comparison",
      description:
        "Buzrr vs Slido compared: live quizzes, scoring, polls and Q&A, integrations, open source and self-hosting — with sources and clearly marked unknowns.",
      h1: "Buzrr vs Slido",
      intro: [
        "Slido and Buzrr overlap on one feature — live quizzes — and differ on almost everything else. Slido is an audience interaction suite for meetings and events; Buzrr is a quiz game platform.",
        "Buzrr's column comes from our code. Slido's column cites Slido's features page; anything we couldn't confirm is marked as not verified.",
      ],
      rows: [
        "openSource",
        "selfHost",
        "liveQuiz",
        "scoring",
        "oneVsOne",
        "aiQuiz",
        "aiDocuments",
        "audienceTools",
        "integrations",
        "selfPaced",
        "pricing",
      ],
      chooseBuzrr: [
        "The quiz is the point of the session, and you want a game with a winner.",
        "You want ranked 1v1 play or friend challenges after the event.",
        "You need an open-source or self-hosted tool.",
      ],
      chooseCompetitor: [
        "You need Q&A, polls, word clouds or surveys.",
        "You present from PowerPoint or Google Slides, or meet in Webex, Zoom or Teams, and want interactions built in.",
      ],
      useCases: [
        "live-audience-quizzes",
        "corporate-training",
        "college-events",
      ],
    },
  },

  mentimeter: {
    slug: "mentimeter",
    name: "Mentimeter",
    displayName: "Mentimeter",
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
    ],
    cells: {
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      liveQuiz: {
        status: "yes",
        text: "Yes — Quiz Competition slides inside a presentation",
        source: 0,
      },
      join: {
        status: "yes",
        text: "Code at menti.com; no participant account",
        source: 1,
      },
      scoring: {
        status: "yes",
        text: "Optional time-based scoring, 1,000 to 500 points per correct answer",
        source: 0,
      },
      oneVsOne: UNVERIFIED("Mentimeter"),
      aiQuiz: UNVERIFIED("Mentimeter"),
      aiDocuments: UNVERIFIED("Mentimeter"),
      selfPaced: UNVERIFIED("Mentimeter"),
      questionTypes: {
        status: "yes",
        text: "Select Answer and Type Answer quiz slides",
        source: 0,
      },
      audienceTools: UNVERIFIED("Mentimeter"),
      integrations: UNVERIFIED("Mentimeter"),
      pricing: {
        status: "info",
        text: "Free and paid plans — see Mentimeter's plans page",
        source: 2,
      },
    },
    alternative: {
      teaser:
        "A standalone quiz game instead of quiz slides inside a presentation.",
      title: "Open-Source Mentimeter Alternative for Quiz Games",
      description:
        "An open-source Mentimeter alternative for quiz competitions: a standalone live quiz game with QR join, speed scoring, full leaderboards and AI questions.",
      h1: "A Mentimeter alternative for quiz competitions",
      lead: "In Mentimeter, a quiz is a set of slides inside a presentation. In Buzrr, the quiz is the whole app: a standalone game with its own host screen, player view and leaderboard.",
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
            text: "Mentimeter is a cloud service. Buzrr is GPL-3.0 open source.",
          },
        ],
      },
      differences: {
        heading: "How Buzrr differs from Mentimeter",
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
            title: "AI with citations",
            text: "Generate questions from uploaded PDFs, DOCX, TXT or Markdown; each question links back to the passage it came from.",
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
      keyRows: [
        "openSource",
        "liveQuiz",
        "scoring",
        "questionTypes",
        "oneVsOne",
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
      answer: {
        question: "Is Buzrr a good Mentimeter alternative?",
        text: "For quiz competitions, yes: Buzrr is a standalone live quiz game with code, link or QR join, speed-based scoring and a full leaderboard, and it's open source. It is not presentation software — there are no content slides or non-quiz question types — so it replaces Mentimeter only where the session is the quiz.",
      },
    },
    compare: {
      teaser:
        "Joining, time-based scoring, leaderboards and question types, with help-center sources.",
      title: "Buzrr vs Mentimeter: Quiz Features Compared",
      description:
        "Buzrr vs Mentimeter for live quizzes: joining, speed scoring, leaderboards, question types, open source and self-hosting, with help-center sources.",
      h1: "Buzrr vs Mentimeter",
      intro: [
        "Mentimeter is presentation software with quiz slides; Buzrr is a quiz game with nothing else attached. Both let an audience join with a code and compete for points on speed.",
        "Buzrr's column is from our code. Mentimeter's column cites its help center; unconfirmed items are marked as not verified.",
      ],
      rows: [
        "openSource",
        "selfHost",
        "liveQuiz",
        "join",
        "scoring",
        "questionTypes",
        "oneVsOne",
        "aiQuiz",
        "aiDocuments",
        "pricing",
      ],
      chooseBuzrr: [
        "Your event is a quiz, not a presentation.",
        "You want every player on the leaderboard and results saved.",
        "You want open-source software or a self-hosted instance.",
      ],
      chooseCompetitor: [
        "You're presenting and want quiz questions between content slides.",
        "You need type-your-answer questions.",
      ],
      useCases: [
        "live-audience-quizzes",
        "classroom-quizzes",
        "corporate-training",
      ],
    },
  },

  quizizz: {
    slug: "quizizz",
    name: "Wayground",
    displayName: "Quizizz (now Wayground)",
    summary: {
      status: "info",
      text: "Quizizz rebranded as Wayground in June 2025. It is now a broader instructional platform with assessments, homework, interactive presentations, AI tools, accommodations and LMS integration.",
      source: 1,
    },
    sources: [
      { label: "Wayground home page", href: "https://wayground.com" },
      {
        label: "THE Journal: Quizizz Rebrands as Wayground (June 2025)",
        href: "https://thejournal.com/Articles/2025/06/24/Quizizz-Rebrands-as-Wayground-Announces-New-AI-Features.aspx",
      },
    ],
    cells: {
      openSource: PROPRIETARY,
      selfHost: CLOUD_ONLY,
      liveQuiz: {
        status: "yes",
        text: "Yes — assessments can run as a competitive game",
        source: 0,
      },
      join: UNVERIFIED("Wayground"),
      scoring: UNVERIFIED("Wayground"),
      oneVsOne: UNVERIFIED("Wayground"),
      aiQuiz: {
        status: "yes",
        text: "Yes — AI generators for questions, lesson plans, rubrics and worksheets",
        source: 0,
      },
      aiDocuments: UNVERIFIED("Wayground"),
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
      pricing: UNVERIFIED("Wayground"),
    },
    alternative: {
      teaser:
        "Just the live quiz game, now that Quizizz has become Wayground's full teaching platform.",
      title: "Quizizz (Wayground) Alternative for Live Quiz Games",
      description:
        "Quizizz is now Wayground. If you just want live quiz games, Buzrr is a free, open-source alternative with QR join, speed scoring and AI questions.",
      h1: "A Quizizz alternative for people who just want the quiz game",
      lead: "Quizizz became Wayground in 2025 and grew into a full instructional platform — homework, presentations, accommodations, district reporting. Buzrr stays small: live quiz games, 1v1 battles and AI to write the questions.",
      whyLook: {
        heading: "Why people look for a Quizizz alternative",
        points: [
          {
            title: "The product changed shape",
            text: "Wayground describes itself as a place for activities, assessments, presentations, videos and flashcards. If all you used was the live quiz game, a focused tool may be easier.",
          },
          {
            title: "It's not only for school",
            text: "Wayground is built for teachers and districts. Buzrr works the same for classrooms, fests, trivia nights and team socials.",
          },
          {
            title: "Open source matters",
            text: "Wayground is a proprietary cloud platform. Buzrr's code is public, GPL-3.0, and can be self-hosted.",
          },
        ],
      },
      differences: {
        heading: "How Buzrr differs from Quizizz / Wayground",
        points: [
          {
            title: "Host-paced live games",
            text: "A Buzrr room moves when the host clicks Next, with an answer chart and running leaderboard between questions — built for a room playing together.",
          },
          {
            title: "Ranked 1v1 battles",
            text: "Students or friends with accounts can play seven-question ranked duels with ELO matchmaking, outside any lesson.",
          },
          {
            title: "Cited AI questions",
            text: "Upload notes or a chapter PDF to a Knowledge Space and every generated question cites the passage it came from.",
          },
          {
            title: "Self-hosting",
            text: "Schools or clubs can run their own Buzrr instance under GPL-3.0.",
          },
        ],
      },
      features: [
        "liveRooms",
        "liveResults",
        "aiQuiz",
        "knowledgeSpaces",
        "duels",
        "roomControls",
        "images",
        "selfHost",
        "guestPlayers",
      ],
      keyRows: [
        "openSource",
        "liveQuiz",
        "selfPaced",
        "integrations",
        "oneVsOne",
      ],
      goodFit: [
        "You mostly ran live Quizizz games and want something focused on that.",
        "You also host quizzes outside the classroom.",
        "You want an open-source tool.",
      ],
      stayWith: [
        "You assign self-paced homework or practice — Buzrr is live only.",
        "You need LMS, rostering or SSO integration.",
        "You rely on accommodations such as read-aloud or translation.",
        "You need integrity features like lockdown mode for assessments.",
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
      related: ["kahoot", "mentimeter", "slido", "quizup"],
      answer: {
        question: "Is Quizizz still called Quizizz?",
        text: "No. Quizizz rebranded as Wayground in June 2025 and moved to wayground.com. Buzrr is an alternative for the live quiz game part only: it doesn't offer homework, accommodations or LMS integration.",
      },
    },
    compare: {
      teaser: "Live games vs homework, AI, LMS integration and accommodations.",
      title: "Buzrr vs Quizizz (Wayground): Comparison",
      description:
        "Buzrr vs Quizizz (now Wayground): live games, homework, AI generation, integrations, open source and self-hosting compared, with sources.",
      h1: "Buzrr vs Quizizz (Wayground)",
      intro: [
        "Quizizz is now Wayground, an instructional platform for schools and districts. Buzrr is a live quiz game. They overlap in the live quiz, and Wayground covers much more classroom workflow around it.",
        "Buzrr's column is from our code. Wayground's column cites its own site and coverage of the rebrand; unconfirmed items are marked as not verified.",
      ],
      rows: [
        "openSource",
        "selfHost",
        "liveQuiz",
        "selfPaced",
        "aiQuiz",
        "aiDocuments",
        "oneVsOne",
        "audienceTools",
        "integrations",
        "pricing",
      ],
      chooseBuzrr: [
        "You want live quiz games for class and beyond, without a full instructional platform.",
        "You want ranked 1v1 quiz battles.",
        "You need open-source or self-hosted software.",
      ],
      chooseCompetitor: [
        "You assign homework and practice, and want it auto-graded.",
        "You need LMS, rostering and SSO integration, accommodations or district reporting.",
      ],
      useCases: ["classroom-quizzes", "college-events", "pub-trivia"],
    },
  },

  quizup: {
    slug: "quizup",
    name: "QuizUp",
    displayName: "QuizUp",
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
      lead: "QuizUp went offline in March 2021. Buzrr's duel mode is our take on what made it fun: you against one opponent, seven timed multiple-choice questions, speed counts.",
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
      keyRows: [],
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
      answer: {
        question: "Is there a QuizUp replacement?",
        text: "QuizUp shut down in March 2021. Buzrr offers the closest core loop we know how to build: ranked 1v1 matches of seven timed multiple-choice questions with ELO matchmaking and friend invites, in the browser. It doesn't recreate QuizUp's topic categories or social features.",
      },
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
    buzrr: "Active and open source (GPL-3.0)",
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
