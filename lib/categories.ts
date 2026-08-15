export const VIDEO_CATEGORIES = [
  "attack",
  "attack_to_defense",
  "defense",
  "defense_to_attack",
  "special",
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  attack: "攻撃",
  attack_to_defense: "攻撃→守備",
  defense: "守備",
  defense_to_attack: "守備→攻撃",
  special: "特殊局面",
};

export function isVideoCategory(value: string): value is VideoCategory {
  return (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

export const TEAM_CATEGORIES = ["top", "u18"] as const;

export type TeamCategory = (typeof TEAM_CATEGORIES)[number];

export const TEAM_CATEGORY_LABELS: Record<TeamCategory, string> = {
  top: "TOP",
  u18: "U18",
};

export function isTeamCategory(value: string): value is TeamCategory {
  return (TEAM_CATEGORIES as readonly string[]).includes(value);
}
