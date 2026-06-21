export function validateStrategy(strategy: string, rawLegs: any[]): {
  valid: boolean;
  declared: string;
  actual: string;
  matchesLabel: boolean;
  errors: string[];
};
export function classifyLegs(legs: any[]): string;
export const TEMPLATES: Record<string, string>;
