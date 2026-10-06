import fs from "fs";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const data = [
  {
    "Quiz Title": "General Knowledge Quiz",
    "Quiz Description": "A fun quiz to test your general knowledge.",
    "Question Title": "What is the capital of France?",
    "Time Limit (sec)": 15,
    "Option 1": "Berlin",
    "Option 1 is Correct": "FALSE",
    "Option 2": "Madrid",
    "Option 2 is Correct": "FALSE",
    "Option 3": "Paris",
    "Option 3 is Correct": "TRUE",
    "Option 4": "Rome",
    "Option 4 is Correct": "FALSE",
  },
  {
    "Quiz Title": "",
    "Quiz Description": "",
    "Question Title": "Which planet is known as the Red Planet?",
    "Time Limit (sec)": 20,
    "Option 1": "Earth",
    "Option 1 is Correct": "FALSE",
    "Option 2": "Mars",
    "Option 2 is Correct": "TRUE",
    "Option 3": "Jupiter",
    "Option 3 is Correct": "FALSE",
    "Option 4": "",
    "Option 4 is Correct": "",
  },
];

// Write CSV - use explicit \n line endings for cross-platform compatibility
const rows = [
  [
    "Quiz Title",
    "Quiz Description",
    "Question Title",
    "Time Limit (sec)",
    "Option 1",
    "Option 1 is Correct",
    "Option 2",
    "Option 2 is Correct",
    "Option 3",
    "Option 3 is Correct",
    "Option 4",
    "Option 4 is Correct",
  ],
  [
    "General Knowledge Quiz",
    "A fun quiz to test your general knowledge.",
    "What is the capital of France?",
    15,
    "Berlin",
    "FALSE",
    "Madrid",
    "FALSE",
    "Paris",
    "TRUE",
    "Rome",
    "FALSE",
  ],
  [
    "",
    "",
    "Which planet is known as the Red Planet?",
    20,
    "Earth",
    "FALSE",
    "Mars",
    "TRUE",
    "Jupiter",
    "FALSE",
    "",
    "",
  ],
];
const csv =
  rows
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n") + "\n";
fs.writeFileSync("apps/web/public/sample-quiz.csv", csv, { encoding: "utf8" });

// Write Excel
const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Quiz");
XLSX.writeFile(wb, "apps/web/public/sample-quiz.xlsx");

console.log("Templates generated!");
