export function estimateTokens(text: string): number {
  let latin = 0;
  let nonLatin = 0;

  for (const character of text) {
    if (character.charCodeAt(0) <= 0x7f) latin += 1;
    else nonLatin += 1;
  }

  return Math.max(1, Math.ceil(latin / 4 + nonLatin));
}
