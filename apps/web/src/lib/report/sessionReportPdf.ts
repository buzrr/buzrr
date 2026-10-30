import type {
  ReportPlayer,
  ReportQuestion,
  SessionReport,
} from "@buzrr/contract";
import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";

// Builds the Pro session report PDF in the browser: page 1 is the whole
// session, then one page per player in rank order. jsPDF is loaded on demand
// so it never weighs on the game screens.

const BRAND: [number, number, number] = [124, 77, 219];
const INK: [number, number, number] = [28, 27, 34];
const MUTED: [number, number, number] = [110, 108, 120];
const TILE: [number, number, number] = [244, 240, 252];
const GOOD: [number, number, number] = [30, 140, 80];
const BAD: [number, number, number] = [200, 60, 55];

const MARGIN = 14;

const TYPE_LABELS: Record<ReportQuestion["type"], string> = {
  multiple_choice: "Multiple choice",
  true_false: "True / false",
  poll: "Poll",
  word_cloud: "Word cloud",
  rating: "Rating",
  open_text: "Open text",
};

type AutoTable = (doc: jsPDF, options: UserOptions) => void;

function seconds(ms: number | null): string {
  return ms === null ? "–" : `${(ms / 1000).toFixed(1)}s`;
}

function percent(ratio: number | null): string {
  return ratio === null ? "–" : `${Math.round(ratio * 100)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function duration(report: SessionReport): string {
  const end = report.endedAt ?? report.generatedAt;
  const mins = Math.max(
    1,
    Math.round((Date.parse(end) - Date.parse(report.startedAt)) / 60_000),
  );
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** The headline answer of a question: its most-picked one. */
function topAnswer(q: ReportQuestion): string {
  if (q.type === "rating" && q.average !== null) {
    return `Avg ${q.average.toFixed(1)}`;
  }
  const top = [...q.breakdown].sort((a, b) => b.count - a.count)[0];
  return top && top.count > 0 ? `${top.label} (${top.count})` : "–";
}

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

function header(doc: jsPDF, title: string, subtitle: string) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, width, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(
    doc.splitTextToSize(title, width - MARGIN * 2 - 30)[0] ?? "",
    MARGIN,
    12,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, MARGIN, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Buzrr", width - MARGIN, 12, { align: "right" });
}

/** A row of stat tiles; returns the y below them. */
function tiles(
  doc: jsPDF,
  y: number,
  stats: { label: string; value: string }[],
): number {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const gap = 3;
  const w = (width - gap * (stats.length - 1)) / stats.length;
  stats.forEach((stat, i) => {
    const x = MARGIN + i * (w + gap);
    doc.setFillColor(...TILE);
    doc.roundedRect(x, y, w, 18, 2, 2, "F");
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(stat.value, x + w / 2, y + 9, { align: "center" });
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(stat.label.toUpperCase(), x + w / 2, y + 14.5, {
      align: "center",
    });
  });
  return y + 18;
}

function sectionTitle(doc: jsPDF, y: number, text: string) {
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(text, MARGIN, y);
}

/** Smaller type for longer quizzes, so the summary stays on one page. */
function tableFontSize(rows: number): number {
  if (rows <= 12) return 9;
  if (rows <= 20) return 8;
  if (rows <= 30) return 7;
  return 6;
}

const tableBase = (fontSize: number): Partial<UserOptions> => ({
  margin: { left: MARGIN, right: MARGIN },
  theme: "striped",
  styles: {
    fontSize,
    cellPadding: fontSize >= 8 ? 1.6 : 1,
    textColor: INK,
    overflow: "ellipsize",
  },
  headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
  alternateRowStyles: { fillColor: [250, 248, 254] },
});

function summaryPage(doc: jsPDF, report: SessionReport, autoTable: AutoTable) {
  header(
    doc,
    report.quizTitle,
    `Session report · ${formatDate(report.startedAt)} · ${duration(report)} · Room ${report.gameCode}`,
  );
  let y = tiles(doc, 34, [
    { label: "Players", value: String(report.playerCount) },
    { label: "Questions", value: String(report.questionCount) },
    { label: "Avg score", value: Math.round(report.avgScore).toLocaleString() },
    { label: "Accuracy", value: percent(report.accuracy) },
    { label: "Avg time", value: seconds(report.avgTimeMs) },
    { label: "Participation", value: percent(report.participation) },
  ]);

  y += 9;
  sectionTitle(doc, y, "Top players");
  autoTable(doc, {
    ...tableBase(9),
    startY: y + 3,
    head: [["Rank", "Player", "Score", "Correct", "Accuracy", "Avg time"]],
    body: report.players
      .slice(0, 5)
      .map((p) => [
        `#${p.rank}`,
        p.name,
        p.score.toLocaleString(),
        `${p.correct}/${report.scoredQuestionCount}`,
        percent(p.accuracy),
        seconds(p.avgTimeMs),
      ]),
    columnStyles: { 1: { cellWidth: 70 } },
  });

  y = lastY(doc) + 9;
  sectionTitle(doc, y, "Questions");
  const fontSize = tableFontSize(report.questions.length);
  autoTable(doc, {
    ...tableBase(fontSize),
    startY: y + 3,
    head: [
      [
        "#",
        "Question",
        "Type",
        "Answered",
        "Correct",
        "Avg time",
        "Top answer",
      ],
    ],
    body: report.questions.map((q) => [
      String(q.index + 1),
      q.title,
      TYPE_LABELS[q.type],
      `${q.answered}/${report.playerCount}`,
      q.correct === null || report.playerCount === 0
        ? "–"
        : percent(q.correct / report.playerCount),
      seconds(q.avgTimeMs),
      topAnswer(q),
    ]),
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 62 },
      2: { cellWidth: 24 },
      6: { cellWidth: 38 },
    },
  });
}

function playerPage(
  doc: jsPDF,
  report: SessionReport,
  player: ReportPlayer,
  autoTable: AutoTable,
) {
  doc.addPage();
  header(
    doc,
    player.name,
    `#${player.rank} of ${report.playerCount} · ${player.score.toLocaleString()} pts · ${report.quizTitle}`,
  );
  const y = tiles(doc, 34, [
    { label: "Rank", value: `#${player.rank}` },
    { label: "Score", value: player.score.toLocaleString() },
    {
      label: "Correct",
      value: `${player.correct}/${report.scoredQuestionCount}`,
    },
    { label: "Accuracy", value: percent(player.accuracy) },
    { label: "Avg time", value: seconds(player.avgTimeMs) },
    { label: "Fastest correct", value: seconds(player.fastestCorrectMs) },
  ]);

  const questions = report.questions;
  const fontSize = tableFontSize(questions.length);
  autoTable(doc, {
    ...tableBase(fontSize),
    startY: y + 9,
    head: [["#", "Question", "Answer", "Result", "Time", "Points"]],
    body: player.answers.map((a) => [
      String(a.index + 1),
      questions[a.index]?.title ?? "",
      a.answer ?? "No answer",
      a.answer === null
        ? "–"
        : a.isCorrect === null
          ? "Answered"
          : a.isCorrect
            ? "Correct"
            : "Wrong",
      seconds(a.timeMs),
      a.points.toLocaleString(),
    ]),
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 70 },
      2: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 3) return;
      if (data.cell.raw === "Correct") data.cell.styles.textColor = GOOD;
      if (data.cell.raw === "Wrong") data.cell.styles.textColor = BAD;
      if (data.cell.raw === "–") data.cell.styles.textColor = MUTED;
    },
  });
}

function footers(doc: jsPDF, report: SessionReport) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Generated ${formatDate(report.generatedAt)}`, MARGIN, height - 8);
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 8, {
      align: "right",
    });
  }
}

function fileName(report: SessionReport): string {
  const slug =
    report.quizTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "quiz";
  return `buzrr-report-${slug}-${report.startedAt.slice(0, 10)}.pdf`;
}

export async function downloadSessionReport(
  report: SessionReport,
): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: `${report.quizTitle} — session report` });
  summaryPage(doc, report, autoTable);
  for (const player of report.players) {
    playerPage(doc, report, player, autoTable);
  }
  footers(doc, report);
  doc.save(fileName(report));
}
