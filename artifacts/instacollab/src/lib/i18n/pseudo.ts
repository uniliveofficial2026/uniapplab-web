/** Pseudo locales for layout/i18n QA — not copied English. */

export function pseudoExpand(text: string): string {
  const mapped = text.replace(/[A-Za-z]/g, (ch) => {
    const table: Record<string, string> = {
      A: 'Å', B: 'Ḃ', C: 'Ç', D: 'Ď', E: 'É', F: 'Ḟ', G: 'Ġ', H: 'Ĥ', I: 'Í',
      J: 'Ĵ', K: 'Ķ', L: 'Ĺ', M: 'Ṁ', N: 'Ń', O: 'Ö', P: 'Ṗ', Q: 'Ǫ', R: 'Ř',
      S: 'Š', T: 'Ť', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ÿ', Z: 'Ž',
      a: 'å', b: 'ḃ', c: 'ç', d: 'ď', e: 'é', f: 'ḟ', g: 'ġ', h: 'ĥ', i: 'í',
      j: 'ĵ', k: 'ķ', l: 'ĺ', m: 'ṁ', n: 'ń', o: 'ö', p: 'ṗ', q: 'ǫ', r: 'ř',
      s: 'š', t: 'ť', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ÿ', z: 'ž',
    };
    return table[ch] ?? ch;
  });
  return `[!! ${mapped} !!]`;
}

export function pseudoRtl(text: string): string {
  return `\u202E‹‹${text}››\u202C`;
}
