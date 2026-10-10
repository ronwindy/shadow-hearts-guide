/**
 * Split prose into sentences (no wording change) so dense paragraphs can render as bullets.
 * Re-joins splits after a single initial such as "H." so names stay intact.
 */
export const toSentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .reduce<string[]>((acc, part) => {
      if (acc.length && /\b[A-Z]\.$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ' ' + part;
      else acc.push(part);
      return acc;
    }, []);
