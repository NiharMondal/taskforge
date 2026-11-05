/**
 * The issue-key prefix for a project name: initials of up to 4 words
 * ("Web App" → "WA"), or the first 3 characters of a single word
 * ("Taskforge" → "TAS"). Upper-cased; "PRJ" when the name has no ASCII
 * letters or digits, and "P"-prefixed when it would start with a digit.
 *
 * The `project_keys_and_issue_numbers` migration backfilled existing projects
 * with the same rule — keep the two in step.
 */
export function deriveProjectKey(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);

  let base: string;
  if (words.length >= 2) {
    base = words
      .slice(0, 4)
      .map((w) => w[0])
      .join("");
  } else if (words.length === 1) {
    base = words[0].slice(0, 3);
  } else {
    base = "PRJ";
  }

  base = base.toUpperCase();
  return /^[0-9]/.test(base) ? `P${base}` : base;
}

/** `base`, or `base2`, `base3`, ... — the first one not in `taken`. */
export function firstFreeKey(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!used.has(`${base}${n}`)) return `${base}${n}`;
  }
}
