const BAD_WORDS = [
  "spam",
  "scam",
  "kill",
  "nazi",
  "slur",
];

export function isBad(text: string): boolean {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => lower.includes(word));
}
