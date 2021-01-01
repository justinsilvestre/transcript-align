import { NON_LETTERS_DIGITS } from './syncTranscriptWithSubtitles';

export function normalizeText(text: string) {
  return text
    .replace(NON_LETTERS_DIGITS, '')
    .replace(/[\s\n]+/, ' ')
    .trim();
}
