import type { CompetitorSlug } from "./competitors";
import type { FeatureId } from "./product";
import { PLAN_FACTS } from "./product";

export type UseCaseSlug =
  | "classroom-quizzes"
  | "college-events"
  | "corporate-training"
  | "team-building"
  | "pub-trivia"
  | "live-audience-quizzes";

export interface UseCase {
  slug: UseCaseSlug;
  /** Short label for link cards and breadcrumbs. */
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** The situation and what usually goes wrong. */
  problem: { heading: string; paragraphs: string[] };
  /** How Buzrr maps onto it, feature by feature. */
  solution: { heading: string; points: { title: string; text: string }[] };
  /** A concrete run-through of a session. */
  workflow: { heading: string; steps: string[] };
  features: FeatureId[];
  /** Practical tips that only apply to this setting. */
  tips: string[];
  /** Honest limits for this use case. */
  watchOut: string[];
  alternatives: CompetitorSlug[];
  related: UseCaseSlug[];
  cta: { label: string; href: string };
}

const HOST_CTA = { label: "Create your first quiz", href: "/admin" };

export const USE_CASES: Record<UseCaseSlug, UseCase> = {
  "classroom-quizzes": {
    slug: "classroom-quizzes",
    name: "Classroom quizzes",
    title: "Live Classroom Quizzes Students Join Without Accounts",
    description:
      "Live multiple-choice quizzes for class: students join from any browser with a code or QR, no student accounts needed. Free and open source.",
    h1: "Live quizzes for the classroom",
    lead: "Put a code on the projector, students join from their phones or school laptops, and you run a quick review or a revision game in the time it takes to take attendance.",
    problem: {
      heading: "What teachers need from a quiz tool",
      paragraphs: [
        'A review quiz at the end of a lesson only works if getting 30 students into it takes seconds. Every step between "open this site" and the first question — creating accounts, installing an app, remembering passwords — eats into a period that is already short.',
        "The other half is feedback. A quiz is most useful when you can see, question by question, where the class went wrong and talk about it before moving on.",
      ],
    },
    solution: {
      heading: "How Buzrr fits a lesson",
      points: [
        {
          title: "Joining takes one step",
          text: "Students scan the QR code or type the 6-character code and pick a nickname. There are no student accounts to set up or manage.",
        },
        {
          title: "You control the pace",
          text: "Each question closes on its timer, or as soon as everyone has answered. The answer chart stays on screen until you click Next, so there is room to explain.",
        },
        {
          title: "See where the class stands",
          text: "The answer chart after each question shows how many picked each option. Wrong-answer clusters are your cue for a quick re-teach.",
        },
        {
          title: "Draft questions from your notes",
          text: "Upload a chapter PDF or your lesson notes to an AI Knowledge Space and generate questions that cite the passage they came from. Keep the good ones, export them to a quiz.",
        },
      ],
    },
    workflow: {
      heading: "A 10-minute end-of-lesson review",
      steps: [
        "Before class, create a quiz with 8–10 questions. Give recall questions 15 seconds and worked problems longer.",
        "At the end of the lesson, click Host and put the QR code on the projector.",
        "Wait for the lobby to fill; remove any joke nicknames with one click.",
        "Run the questions. After each one, glance at the answer chart and address anything most of the class missed.",
        "Show the final leaderboard. The results stay in your history if you want to compare next week.",
      ],
    },
    features: [
      "liveRooms",
      "guestPlayers",
      "liveResults",
      "knowledgeSpaces",
      "roomControls",
      "rejoin",
    ],
    tips: [
      'Turn on "Hide Questions" in the quiz editor before you project it, so students can\'t read ahead.',
      "Speed scoring rewards quick answers. For a low-stakes review, use generous timers so accuracy matters more than reflexes.",
      "If a student's Wi-Fi drops, they can rejoin the same room and keep their score.",
    ],
    watchOut: [
      "Buzrr has no homework or self-paced mode — every quiz is played live.",
      "There is no LMS or gradebook integration, and results are stored against nicknames, not student records.",
      "Questions are multiple choice with a single correct answer.",
      `The free plan hosts up to ${PLAN_FACTS.freePlayers} players per room, which covers most classes.`,
    ],
    alternatives: ["kahoot", "quizizz", "mentimeter"],
    related: ["college-events", "live-audience-quizzes", "pub-trivia"],
    cta: HOST_CTA,
  },

  "college-events": {
    slug: "college-events",
    name: "College events",
    title: "Quiz Platform for College Fests, Clubs and Tech Events",
    description:
      "Quiz rounds for college fests, clubs and tech events: QR join, live leaderboards, up to 250 players per room on Pro, and an open-source codebase.",
    h1: "Quiz rounds for college fests and club events",
    lead: "Fest quiz rounds, society inductions, freshers' nights, hackathon breaks — Buzrr gets a hall full of people answering on their own phones with one QR code on the screen.",
    problem: {
      heading: "What goes wrong at event quizzes",
      paragraphs: [
        "Event quizzes are run by volunteers, on venue Wi-Fi, in front of a crowd that arrived five minutes ago. Paper answer sheets need marking; hands-up rounds favour the front row; and anything that asks the audience to install an app loses half the room.",
        "Organisers also want a clear winner at the end — a ranked leaderboard they can put on the screen and read out.",
      ],
    },
    solution: {
      heading: "How Buzrr handles an event round",
      points: [
        {
          title: "One QR code for the whole hall",
          text: "Put the room's QR code on the projector. Everyone joins in the browser with a nickname — no sign-up, no app store.",
        },
        {
          title: "Ties broken by speed",
          text: "Correct answers score more the faster they come in, so a close final usually still produces a clear ranking.",
        },
        {
          title: "Rooms sized for a crowd",
          text: `A free room holds ${PLAN_FACTS.freePlayers} players; Buzrr Pro raises that to ${PLAN_FACTS.proPlayers}. A club running its own instance gets ${PLAN_FACTS.proPlayers} by default and can raise a host's cap.`,
        },
        {
          title: "A codebase your club can hack on",
          text: "Buzrr is open source (GPL-3.0) and written in TypeScript with Next.js and NestJS. Coding clubs can self-host it for their fest or contribute features back.",
        },
      ],
    },
    workflow: {
      heading: "Running a fest prelims round",
      steps: [
        "Build the prelims quiz in advance. Add image questions for logo or picture rounds.",
        "On the day, open the room and project the QR code while teams settle in.",
        "Keep an eye on the lobby and ban anyone who joins under an offensive name.",
        "Run the round. The running leaderboard after each question keeps the hall engaged.",
        "Read the top of the final leaderboard to pick your finalists; the full results are saved in your history.",
      ],
    },
    features: [
      "liveRooms",
      "speedScoring",
      "images",
      "roomControls",
      "openSource",
      "selfHost",
    ],
    tips: [
      "Venue Wi-Fi is often the weak link. Ask the audience to use mobile data if the network is crowded; players who drop can rejoin without losing their score.",
      "For team rounds, have each team join as one player with the team name as the nickname.",
      "Between rounds, point people to ranked 1v1 battles to keep them playing.",
    ],
    watchOut: [
      `Rooms are capped at ${PLAN_FACTS.freePlayers} players on Free and ${PLAN_FACTS.proPlayers} on Pro. For a larger audience, split into several rooms.`,
      "Hosts sign in with Google, so the organiser running the room needs a Google account.",
      "There is no built-in buzzer round or open-answer question type.",
    ],
    alternatives: ["kahoot", "slido", "quizup"],
    related: ["pub-trivia", "live-audience-quizzes", "team-building"],
    cta: HOST_CTA,
  },

  "corporate-training": {
    slug: "corporate-training",
    name: "Corporate training",
    title: "Live Knowledge-Check Quizzes for Corporate Training",
    description:
      "Live knowledge checks for training: generate cited questions from your own PDFs and docs, run them live, and self-host if data must stay in-house.",
    h1: "Knowledge checks for training sessions",
    lead: "Turn a training document into a live quiz at the end of the session: generate questions from the material, check what landed, and keep the whole thing on your own servers if you need to.",
    problem: {
      heading: "Why training quizzes are hard to keep up",
      paragraphs: [
        "Writing good check questions for every onboarding deck, policy update or product briefing takes time trainers rarely have. So the quiz gets skipped, and nobody learns which parts of the session did not land.",
        "For many teams there is a second problem: the training material is internal, and uploading it to yet another SaaS tool needs a security review.",
      ],
    },
    solution: {
      heading: "How Buzrr helps trainers",
      points: [
        {
          title: "Questions drafted from your material",
          text: "Upload the deck export, policy PDF or handbook page to an AI Knowledge Space. Buzrr generates questions grounded in the document, each with a citation to the source passage, so reviewing them is quick.",
        },
        {
          title: "A live check, not a form",
          text: "Run the questions live at the end of the session. The per-question answer chart shows which topics need a follow-up.",
        },
        {
          title: "Self-host when data can't leave",
          text: "Buzrr is GPL-3.0 open source. You can deploy it on your own infrastructure with your own database, Redis and AI key, and inspect exactly what it does with uploaded documents.",
        },
      ],
    },
    workflow: {
      heading: "From policy PDF to live quiz",
      steps: [
        "Create a Knowledge Space for the course and upload the source documents (PDF, DOCX, TXT or Markdown).",
        "Generate a batch of questions and review each one against its cited passage.",
        "Export the questions you keep into a quiz and adjust the time limits.",
        "At the end of the session, host the quiz; participants join by link from the meeting chat or by QR in the room.",
        "Use the answer chart to decide what to recap, and keep the results in your history.",
      ],
    },
    features: [
      "knowledgeSpaces",
      "aiQuiz",
      "liveRooms",
      "liveResults",
      "selfHost",
      "guestPlayers",
    ],
    tips: [
      "Paste the join link into the meeting chat for remote attendees; they play in a browser tab next to the call.",
      "Keep AI-generated questions honest: check each one against its citation before exporting.",
      `On the free plan you get ${PLAN_FACTS.freeAi} AI generations in total; Pro includes ${PLAN_FACTS.proAiPerWeek} a week.`,
    ],
    watchOut: [
      "There is no SSO, LMS or HRIS integration, and participants are guests — results are not tied to employee records.",
      "No completion tracking or certificates: Buzrr is a live quiz tool, not a learning management system.",
      "Hosts sign in with Google.",
    ],
    alternatives: ["kahoot", "slido", "mentimeter"],
    related: ["team-building", "live-audience-quizzes", "classroom-quizzes"],
    cta: HOST_CTA,
  },

  "team-building": {
    slug: "team-building",
    name: "Team building",
    title: "Team Building Quizzes for Remote and Office Teams",
    description:
      "Run a team quiz in 15 minutes: share a link in the call, everyone plays in the browser, with speed scoring, a live leaderboard and 1v1 rematches.",
    h1: "Quick quizzes for team building",
    lead: "A Friday quiz, an all-hands icebreaker, an offsite warm-up. Drop the join link in chat and the whole team is playing inside a minute, remote or in the room.",
    problem: {
      heading: "What makes a team quiz work",
      paragraphs: [
        "Team quizzes live or die on friction. If joining takes longer than the first question, half the call is still fiddling while the other half waits.",
        'The best ones are also about the team: in-jokes, office trivia, "whose desk is this?" photo rounds. That means writing your own questions, quickly.',
      ],
    },
    solution: {
      heading: "How Buzrr keeps it light",
      points: [
        {
          title: "A link in the chat is enough",
          text: "Share the room link in Slack, Teams or the meeting chat. Colleagues open it, pick a name and avatar, and they are in the lobby.",
        },
        {
          title: "Photo rounds",
          text: "Add an image to any question for baby-photo guessing, office-landmark or product-screenshot rounds.",
        },
        {
          title: "Rematches with 1v1 battles",
          text: "After the group round, colleagues with Buzrr accounts can challenge each other to a 1v1 match with an invite link.",
        },
        {
          title: "AI for the generic rounds",
          text: "Need a general-knowledge warm-up? Describe the topic and let AI draft the questions, then write the team-specific ones yourself.",
        },
      ],
    },
    workflow: {
      heading: "A 15-minute Friday quiz",
      steps: [
        "Write ten questions: a few about the team, a few about your product, and a general-knowledge warm-up drafted with AI.",
        "At the start of the call, host the quiz and paste the link in chat.",
        "Share your screen with the host view so everyone sees the question, then the answer chart and running leaderboard.",
        "Play it through, then crown the winner from the final leaderboard.",
      ],
    },
    features: [
      "liveRooms",
      "images",
      "friendInvites",
      "aiQuiz",
      "speedScoring",
      "browser",
    ],
    tips: [
      "Players see the question and options on their own device, so it works even when screen-sharing lags.",
      "Mix in easy questions: speed scoring means everyone still gets points on a question they know.",
      "Keep the quiz and host it again next month with new questions — past results are in your history.",
    ],
    watchOut: [
      "There are no Slack or Teams apps — you share a link.",
      "Only multiple-choice questions: no open-text, drawing or poll rounds.",
    ],
    alternatives: ["kahoot", "slido", "quizup"],
    related: ["corporate-training", "pub-trivia", "college-events"],
    cta: HOST_CTA,
  },

  "pub-trivia": {
    slug: "pub-trivia",
    name: "Pub & online trivia",
    title: "Host Pub Trivia and Online Trivia Nights in the Browser",
    description:
      "Run pub trivia or an online trivia night: teams join by QR on their phones, with picture rounds, automatic scoring and a live leaderboard. No app needed.",
    h1: "Trivia nights without the answer sheets",
    lead: "Whether it's a regular pub quiz or a trivia night over video call, Buzrr does the marking and the leaderboard so the quizmaster can concentrate on the banter.",
    problem: {
      heading: "The unglamorous part of running trivia",
      paragraphs: [
        "Every quizmaster knows the gap between rounds: collecting answer sheets, marking them, adding up totals and arguing about handwriting. It kills the momentum of the night.",
        "Online trivia has its own version of the problem — people shouting answers over each other on a call, or typing them into chat where everyone can see.",
      ],
    },
    solution: {
      heading: "How Buzrr runs a trivia night",
      points: [
        {
          title: "Instant marking",
          text: "Answers are scored the moment the question closes. The leaderboard is ready before you have finished reading the answer out.",
        },
        {
          title: "Picture rounds built in",
          text: "Attach an image to a question for flags, logos, famous faces or a zoomed-in mystery object.",
        },
        {
          title: "Phones in, answer sheets out",
          text: "Teams scan a QR code at their table and answer on one phone. Nobody needs an account or an app.",
        },
      ],
    },
    workflow: {
      heading: "Running a four-round pub quiz",
      steps: [
        "Build each round as its own quiz — general knowledge, picture round, music intros read aloud, local trivia.",
        "Print the room QR code on the table cards, or show it on the pub screen.",
        "Teams join with their team name as the nickname.",
        "Host each round in turn and show the leaderboard between rounds.",
        "Past quiz nights stay in your history, so you can see who keeps winning.",
      ],
    },
    features: [
      "liveRooms",
      "images",
      "speedScoring",
      "liveResults",
      "roomControls",
      "guestPlayers",
    ],
    tips: [
      "Speed scoring adds tension, but for a relaxed pub crowd give each question a longer timer.",
      "Each round is a separate room, so scores don't carry across rounds automatically — keep a running tally if you want an overall winner.",
      "Use the ban button if someone joins under a name the pub wouldn't approve of.",
    ],
    watchOut: [
      "No audio or video questions — play music clips from your own speaker and ask the question in Buzrr.",
      "Answers are multiple choice; there is no type-your-answer round.",
      "Scores don't accumulate across separate quizzes.",
    ],
    alternatives: ["quizup", "kahoot", "mentimeter"],
    related: ["team-building", "college-events", "live-audience-quizzes"],
    cta: HOST_CTA,
  },

  "live-audience-quizzes": {
    slug: "live-audience-quizzes",
    name: "Live audience quizzes",
    title: "Live Audience Quizzes for Talks, Streams and Meetups",
    description:
      "Add a competitive quiz to a talk, meetup or livestream: the audience joins by QR or link, answers on their phones, and a live leaderboard picks a winner.",
    h1: "Quiz your audience, live",
    lead: "Close a talk with a five-question quiz, run a trivia segment on a livestream, or warm up a meetup crowd. The audience joins from their phones; the leaderboard does the rest.",
    problem: {
      heading: "Keeping an audience with you",
      paragraphs: [
        "A room of people watching one speaker drifts. A short quiz — especially one with a leaderboard and a winner — brings attention back and tells you what stuck.",
        "For a talk or a stream, the quiz has to be instant to join and simple to follow, because you only have the audience's attention for a few minutes.",
      ],
    },
    solution: {
      heading: "How Buzrr works for audiences",
      points: [
        {
          title: "Join from the screen",
          text: "Show the QR code on your slide or overlay it on the stream. The audience joins in the browser in seconds.",
        },
        {
          title: "A competitive format",
          text: "Speed-based scoring and a live leaderboard make it a game, with a clear winner for a prize or a shout-out.",
        },
        {
          title: "Questions from your talk",
          text: "Upload your slides export or talk notes to a Knowledge Space and generate questions from them, each with a citation back to your material.",
        },
      ],
    },
    workflow: {
      heading: "A quiz at the end of a talk",
      steps: [
        "Write five questions about the talk, or generate them from your notes.",
        "Put the join QR code on your last content slide so people join while you wrap up.",
        "Switch to the host view and run the quiz, pausing on the answer chart for any question the room found hard.",
        "Announce the winner from the final leaderboard.",
      ],
    },
    features: [
      "liveRooms",
      "speedScoring",
      "liveResults",
      "knowledgeSpaces",
      "guestPlayers",
      "browser",
    ],
    tips: [
      "Stream viewers see the host screen with a delay, but each player's question appears on their own device, so they aren't answering against the stream lag alone.",
      "Keep audience quizzes short — five to seven questions is plenty.",
    ],
    watchOut: [
      "Buzrr is quiz-only: there is no audience Q&A, polling, word clouds or slide presentation. Tools like Slido and Mentimeter cover those.",
      `Room size is capped at ${PLAN_FACTS.freePlayers} players on Free and ${PLAN_FACTS.proPlayers} on Pro.`,
      "There is no PowerPoint or Google Slides integration — you switch from your slides to the Buzrr host tab.",
    ],
    alternatives: ["slido", "mentimeter", "kahoot"],
    related: ["college-events", "corporate-training", "classroom-quizzes"],
    cta: HOST_CTA,
  },
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES) as UseCaseSlug[];
