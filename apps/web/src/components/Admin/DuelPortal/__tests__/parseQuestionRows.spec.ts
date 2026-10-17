import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_ROWS, parseQuestionRows } from "../parseQuestionRows";

const mcq = {
  Question: "Capital of France?",
  Type: "MCQ",
  "Option 1": "Berlin",
  "Option 2": "Paris",
  "Option 3": "Rome",
  "Option 4": "",
  "Correct Option": "2",
  "Time Limit (sec)": "20",
};

describe("parseQuestionRows", () => {
  it("reads a multiple-choice row", () => {
    const { valid, errors } = parseQuestionRows([mcq]);
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      {
        row: 2,
        type: "multiple_choice",
        title: "Capital of France?",
        timeOut: 20,
        options: [
          { title: "Berlin", isCorrect: false },
          { title: "Paris", isCorrect: true },
          { title: "Rome", isCorrect: false },
        ],
        config: {},
      },
    ]);
  });

  it("defaults a blank type to multiple choice and allows no time limit", () => {
    const { valid } = parseQuestionRows([
      { ...mcq, Type: "", "Time Limit (sec)": "" },
    ]);
    expect(valid[0]?.type).toBe("multiple_choice");
    expect(valid[0]?.timeOut).toBeUndefined();
  });

  it("keeps the correct option aligned when a middle option is blank", () => {
    const { valid } = parseQuestionRows([
      { ...mcq, "Option 2": "", "Option 4": "Paris", "Correct Option": "4" },
    ]);
    expect(valid[0]?.options.map((o) => o.isCorrect)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("reads true / false rows, ignoring option columns", () => {
    const { valid } = parseQuestionRows([
      {
        Question: "The sky is green",
        Type: "True/False",
        "Correct Option": "false",
      },
    ]);
    expect(valid[0]).toMatchObject({
      type: "true_false",
      options: [],
      config: { answer: false },
    });
  });

  it("matches headers loosely", () => {
    const { valid } = parseQuestionRows([
      {
        " question ": "Q?",
        option1: "A",
        "OPTION 2": "B",
        "correct option": "a",
      },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0]?.options[0]?.isCorrect).toBe(true);
  });

  it("reports bad rows with their sheet row instead of fixing them", () => {
    const { valid, errors } = parseQuestionRows([
      { ...mcq, "Correct Option": "" },
      { ...mcq, "Option 2": "", "Option 3": "" },
      { ...mcq, "Correct Option": "4" },
      { ...mcq, Type: "poll" },
      { ...mcq, Question: "" },
      { ...mcq, "Time Limit (sec)": "2" },
      { Question: "TF", Type: "tf", "Correct Option": "maybe" },
    ]);
    expect(valid).toEqual([]);
    expect(errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("skips blank rows and uses SheetJS row numbers", () => {
    const sheetRow = Object.defineProperty(
      { ...mcq, Question: "" },
      "__rowNum__",
      {
        value: 9,
        enumerable: false,
      },
    );
    const { errors } = parseQuestionRows([
      { Question: "", Type: "" },
      sheetRow,
    ]);
    expect(errors).toEqual([{ row: 10, message: "Question is empty" }]);
  });

  it("stops reading past the row cap", () => {
    const rows = Array.from({ length: MAX_UPLOAD_ROWS + 3 }, () => mcq);
    const result = parseQuestionRows(rows);
    expect(result.valid).toHaveLength(MAX_UPLOAD_ROWS);
    expect(result.truncated).toBe(3);
  });
});
