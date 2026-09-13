// src/lib/classify.ts
import type { WhaleCategory } from "../types/whale";

// Keyword → category classification from real market titles. Order matters:
// the first matching category wins, so Sports (very common on Polymarket) and
// Crypto are checked before the broader buckets.
export const CATEGORY_KEYWORDS: { category: WhaleCategory; words: string[] }[] = [
  { category: "Crypto", words: ["btc", "bitcoin", "eth", "ethereum", "sol", "solana", "crypto", "coin", "token", "xrp", "doge", "nft"] },
  {
    category: "Sports",
    words: [
      "fc", "cf", "united", "city", "vs", "win on", "match", "cup", "league",
      "nba", "nfl", "mlb", "nhl", "ufc", "premier", "la liga", "serie a",
      "champions", "playoff", "super bowl", "world cup", "tennis", "atp", "wta",
      "soccer", "football", "basketball", "baseball", "hockey", "score",
      "whitecaps", "grand prix", "f1", "formula",
    ],
  },
  { category: "Politics", words: ["president", "election", "senate", "congress", "trump", "biden", "governor", "poll", "vote", "shutdown", "speaker", "cabinet", "primary", "nominee"] },
  { category: "Macro", words: ["fed", "rate", "cpi", "inflation", "recession", "gdp", "unemployment", "jobs", "yield", "oil", "gold", "ecb", "interest"] },
  { category: "Pop Culture", words: ["movie", "oscar", "album", "box office", "grammy", "show", "celebrity", "award", "streaming", "spotify", "netflix"] },
];

// Compile one regex per keyword list. Short keywords (<= 4 chars, e.g. eth,
// sol, fc, cf, oil) require BOTH word boundaries so they don't match inside
// unrelated words like "som(eth)ing". Longer keywords only need a leading
// boundary, so "oscar" still matches "oscars", "election" matches "elections".
const escapeRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPILED = CATEGORY_KEYWORDS.map(({ category, words }) => {
  const parts = words.map((w) => {
    const e = escapeRe(w);
    return w.length <= 4 ? `\\b${e}\\b` : `\\b${e}`;
  });
  return { category, re: new RegExp(`(?:${parts.join("|")})`, "i") };
});

/** Classify one or more market titles into a category; unmatched → "Other". */
export function classifyTitles(titles: string[]): WhaleCategory {
  const hay = titles.join(" ");
  for (const { category, re } of COMPILED) {
    if (re.test(hay)) return category;
  }
  return "Other";
}
