import { CATEGORY_GROUP_LABELS, categoryGroups } from "@/lib/categories";
import type { Category } from "@/generated/prisma/client";

export type MatchPostScorer = { number: number | null; name: string; goals: number };

export type MatchPostInput = {
  eventTitle: string;
  eventCategories: Category[];
  startAt: Date;
  opponent: string;
  ourScore: number;
  opponentScore: number;
  scorers: MatchPostScorer[];
};

function resultLabel(ourScore: number, opponentScore: number): string {
  if (ourScore > opponentScore) return "Win🔥";
  if (ourScore < opponentScore) return "Lose";
  return "Draw";
}

function categoryLabel(categories: Category[]): string {
  const groups = categoryGroups(categories);
  return groups.map((g) => (g === "U18" ? "U-18" : CATEGORY_GROUP_LABELS[g])).join("・");
}

export function buildInstagramPost(input: MatchPostInput): string {
  const dateLabel = input.startAt.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
  const label = categoryLabel(input.eventCategories);
  const scorerLines =
    input.scorers.length > 0
      ? input.scorers
          .map((s) => {
            const numberPart = s.number !== null ? `No.${s.number} ` : "";
            const goalsPart = s.goals > 1 ? ` ${s.goals}goal` : "";
            return `${numberPart}${s.name}${goalsPart}`;
          })
          .join("\n")
      : null;

  const lines = [
    `【${label}試合結果】`,
    `${dateLabel}の試合結果をお知らせします！`,
    "",
    `vs ${input.opponent}`,
    `${input.ourScore}-${input.opponentScore} ${resultLabel(input.ourScore, input.opponentScore)}`,
  ];
  if (scorerLines) {
    lines.push("得点者", scorerLines);
  }
  lines.push("", "応援ありがとうございました！");
  return lines.join("\n");
}
