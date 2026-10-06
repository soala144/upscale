export type LeadScoringInput = {
  need: string | null;
  budget: string | number | null;
  timeline: string | null;
  decisionMaker: boolean | null;
};

export type LeadScoreStage = "HOT" | "WARM" | "COLD";

export type LeadScore = {
  score: number;
  stage: LeadScoreStage;
  breakdown: {
    needClarity: number;
    budget: number;
    timeline: number;
    decisionMaker: number;
  };
};

export function classifyLeadScore(score: number): LeadScoreStage {
  return score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD";
}

function isPresent(value: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveBudget(value: string | number | null) {
  if (value === null || value === "") {
    return false;
  }

  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0;
}

export function scoreLead(input: LeadScoringInput): LeadScore {
  const breakdown = {
    needClarity: isPresent(input.need) ? 25 : 0,
    budget: hasPositiveBudget(input.budget) ? 25 : 0,
    timeline: isPresent(input.timeline) ? 25 : 0,
    decisionMaker: input.decisionMaker === true ? 25 : 0,
  };
  const score = Object.values(breakdown).reduce(
    (total, criterionScore) => total + criterionScore,
    0,
  );

  return {
    score,
    stage: classifyLeadScore(score),
    breakdown,
  };
}
