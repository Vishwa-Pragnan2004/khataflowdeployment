export type CustomerOption = { id: number; name: string };

// Scores a name against a query (already trimmed and lowercased).
// Returns null when the name does not contain the query.
function scoreName(name: string, q: string): { score: number; pos: number } | null {
  const lower = name.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return null;
  if (idx === 0) return { score: 0, pos: 0 };

  // Find the first position where a word starts with the query.
  let wordStart = -1;
  let from = 0;
  while (from < lower.length) {
    const p = lower.indexOf(q, from);
    if (p === -1) break;
    if (p === 0 || /[^\p{L}\p{N}]/u.test(lower[p - 1])) {
      wordStart = p;
      break;
    }
    from = p + 1;
  }
  if (wordStart !== -1) return { score: 1, pos: wordStart };

  return { score: 2, pos: idx };
}

export function rankCustomers(
  customers: CustomerOption[],
  query: string,
  limit = 8,
): CustomerOption[] {
  const q = query.trim().toLowerCase();

  if (q === "") {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  }

  const scored: { customer: CustomerOption; score: number; pos: number }[] = [];
  for (const customer of customers) {
    const result = scoreName(customer.name, q);
    if (result) {
      scored.push({ customer, score: result.score, pos: result.pos });
    }
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.pos - b.pos ||
      a.customer.name.localeCompare(b.customer.name),
  );

  return scored.slice(0, limit).map((s) => s.customer);
}
