import {
  MIN_TIME_OUT,
  questionDefinitionSchema,
  type QuestionDefinitionInput,
} from "@buzrr/contract";

/** Upper bound on one file, so a stray huge sheet can't lock the tab. */
export const MAX_UPLOAD_ROWS = 2000;

const OPTION_COLUMNS = 4;

/**
 * The bulk-upload template's columns. Headers are matched loosely (case,
 * spaces and punctuation ignored), so "correct option" or "Time limit" work.
 */
export const TEMPLATE_HEADERS = [
  "Question",
  "Type",
  "Option 1",
  "Option 2",
  "Option 3",
  "Option 4",
  "Correct Option",
  "Time Limit (sec)",
] as const;

export type ParsedQuestion = Required<
  Pick<QuestionDefinitionInput, "type" | "title" | "options">
> &
  Pick<QuestionDefinitionInput, "timeOut"> & {
    /** The spreadsheet row it came from (header is row 1). */
    row: number;
  };

export type RowError = { row: number; message: string };

export type ParseResult = {
  valid: ParsedQuestion[];
  errors: RowError[];
  /** Rows past MAX_UPLOAD_ROWS that were not read. */
  truncated: number;
};

const HEADER_ALIASES: Record<string, string> = {
  question: "question",
  questiontitle: "question",
  title: "question",
  type: "type",
  questiontype: "type",
  correctoption: "correct",
  correct: "correct",
  correctanswer: "correct",
  answer: "correct",
  timelimitsec: "time",
  timelimit: "time",
  time: "time",
};

function normalizeHeader(header: string): string {
  const key = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const option = /^option([1-9])$/.exec(key);
  if (option) return `option${option[1]}`;
  return HEADER_ALIASES[key] ?? key;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseType(raw: string): "multiple_choice" | "true_false" | null {
  const key = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (["", "mcq", "multiplechoice", "mc"].includes(key)) {
    return "multiple_choice";
  }
  if (["truefalse", "tf", "boolean"].includes(key)) return "true_false";
  return null;
}

function parseBoolean(raw: string): boolean | null {
  const key = raw.toLowerCase();
  if (["true", "t", "yes"].includes(key)) return true;
  if (["false", "f", "no"].includes(key)) return false;
  return null;
}

/** "2" or "B" → 2. */
function parseOptionNumber(raw: string): number | null {
  if (/^[1-9]$/.test(raw)) return Number(raw);
  const letter = /^[a-z]$/i.exec(raw);
  if (letter) return raw.toUpperCase().charCodeAt(0) - 64;
  return null;
}

/**
 * Turns spreadsheet rows (header → value, as Papa / SheetJS produce them)
 * into standalone duel questions. Bad rows are reported, never auto-fixed:
 * a guessed correct answer would go live once approved. Fully blank rows are
 * ignored.
 */
export function parseQuestionRows(
  rows: readonly Record<string, unknown>[],
): ParseResult {
  const valid: ParsedQuestion[] = [];
  const errors: RowError[] = [];

  rows.slice(0, MAX_UPLOAD_ROWS).forEach((raw, index) => {
    // SheetJS records the 0-based sheet row (it skips blank rows); otherwise
    // assume one data row per line under the header.
    const sheetRow = (raw as { __rowNum__?: unknown }).__rowNum__;
    const row = (typeof sheetRow === "number" ? sheetRow : index + 1) + 1;

    const fields: Record<string, string> = {};
    for (const [header, value] of Object.entries(raw)) {
      fields[normalizeHeader(header)] = cell(value);
    }
    if (Object.values(fields).every((v) => v === "")) return;

    const fail = (message: string) => errors.push({ row, message });

    const title = fields.question ?? "";
    if (!title) return fail("Question is empty");

    const type = parseType(fields.type ?? "");
    if (!type)
      return fail(`Unknown type "${fields.type}" (use MCQ or True/False)`);

    const correctRaw = fields.correct ?? "";
    let options: { title: string; isCorrect: boolean }[];

    if (type === "true_false") {
      const answer = parseBoolean(correctRaw);
      if (answer === null) return fail("Correct Option must be True or False");
      options = [
        { title: "True", isCorrect: answer },
        { title: "False", isCorrect: !answer },
      ];
    } else {
      const filled: { column: number; title: string }[] = [];
      for (let column = 1; column <= OPTION_COLUMNS; column++) {
        const option = fields[`option${column}`] ?? "";
        if (option) filled.push({ column, title: option });
      }
      if (filled.length < 2) return fail("Needs at least 2 options");
      const correct = parseOptionNumber(correctRaw);
      if (correct === null || correct < 1 || correct > OPTION_COLUMNS) {
        return fail(`Correct Option must be 1–${OPTION_COLUMNS}`);
      }
      if (!filled.some((o) => o.column === correct)) {
        return fail(`Correct Option ${correct} is empty`);
      }
      options = filled.map((o) => ({
        title: o.title,
        isCorrect: o.column === correct,
      }));
    }

    let timeOut: number | undefined;
    const time = fields.time ?? "";
    if (time) {
      timeOut = Number(time);
      if (!Number.isInteger(timeOut) || timeOut < MIN_TIME_OUT) {
        return fail(`Time limit must be a whole number ≥ ${MIN_TIME_OUT}`);
      }
    }

    const question = { type, title, options, timeOut };
    const checked = questionDefinitionSchema.safeParse(question);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      const path = issue?.path.join(".") ?? "";
      return fail(
        path.startsWith("title")
          ? "Question is too long (max 2000 characters)"
          : path.startsWith("options")
            ? "An option is too long (max 500 characters)"
            : (issue?.message ?? "Invalid question"),
      );
    }
    valid.push({ ...question, row });
  });

  return {
    valid,
    errors,
    truncated: Math.max(0, rows.length - MAX_UPLOAD_ROWS),
  };
}
