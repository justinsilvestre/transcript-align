import { toRomaji } from './kanaToRomaji'

export function defaultNormalizeJapanese(text: string): string {
  return (
    text
      .replace(/[\s。？」、！』―]+/gu, '')
      // // replace katakana with hiragana
      // .replace(/[\u30A1-\u30F6]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 96))
      // replace kana with romaji
      .replace(/[\u3041-\u3096\u30A1-\u30F6]+/gu, (match) => {
        return toRomaji(match)
      })
      // replace Chinese numerals with Arabic numerals
      .replace(/[〇一二三四五六七八九十百千万]/gu, (match) => {
        return chineseNumeralsToArabic(match)
      })
      .trim()
      .toLowerCase()
  )
}
// prettier-ignore
const CHINESE_NUMERALS_TO_ARABIC: Record<string, string> = {
  '〇': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9'
};
function chineseNumeralsToArabic(text: string): string {
  return text.replace(/[〇一二三四五六七八九]/gu, (match) => {
    return CHINESE_NUMERALS_TO_ARABIC[match] || match
  })
}
