/**
 * Shared Claude response validation helpers.
 *
 * Claude occasionally returns the prompt template literally instead of filling
 * it in (e.g. "• [bullet 1]" or "[salary or none]"). These helpers detect
 * that and fall back to a safe default so broken template text never reaches
 * the DB.
 */

const TEMPLATE_RE = /\[\s*(bullet|salary|compensation|extracted|figure|grade|stipend|5 bull|imperative|overview|action)/i;

/**
 * Returns the parsed bullets string if it looks like real content,
 * otherwise returns the provided fallback.
 */
export function sanitizeBullets(raw: string, fallback: string): string {
  if (!raw || TEMPLATE_RE.test(raw)) return fallback;
  return raw;
}

/**
 * Returns the parsed salary string if it looks like real content,
 * otherwise returns 'See listing'.
 */
export function sanitizeSalary(raw: string): string {
  if (!raw || raw.toLowerCase() === 'none' || TEMPLATE_RE.test(raw)) return 'See listing';
  return raw;
}
