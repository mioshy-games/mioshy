export type QuestionType = string;

export type Question = {
  id: string;
  type: QuestionType;
  text_he: string;
  text_en: string;
};

export type WheelOption = {
  type: QuestionType;
  labelKey: string;
};

const FREE_SPINS = 3;

export function getFreeSpinLimit(): number {
  return FREE_SPINS;
}

export function shouldBlockSpin(completedSpins: number): boolean {
  return completedSpins >= FREE_SPINS;
}

export function pickRandomQuestion(
  type: QuestionType,
  pool: Question[],
): Question {
  const filtered = pool.filter((q) => q.type === type);
  if (filtered.length === 0) {
    throw new Error(`No questions for type: ${type}`);
  }
  const i = Math.floor(Math.random() * filtered.length);
  return filtered[i];
}

export function pickRandomIndex(length: number): number {
  if (length <= 0) return 0;
  return Math.floor(Math.random() * length);
}
