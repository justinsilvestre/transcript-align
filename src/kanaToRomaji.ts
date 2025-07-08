// prettier-ignore
const singleHiraganaToRomaji: Record<string, string> = {
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o', 'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko', 'さ': 'sa', 'し': 'si', 'す': 'su', 'せ': 'se', 'そ': 'so', 'た': 'ta', 'ち': 'tsi', 'つ': 'tsu', 'て': 'te', 'と': 'to', 'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no', 'は': 'ha', 'ひ': 'hi', 'ふ': 'hu', 'へ': 'he', 'ほ': 'ho', 'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo', 'や': 'ya', 'ゆ': 'yu', 'よ': 'yo', 'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro', 'わ': 'wa', 'を': 'wo', 'ん': 'n',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'zi', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'dzi', 'づ': 'dzu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo', 'ゔ': 'bvu',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'っ': '', 'ゎ': 'wa', 
  'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
}
// prettier-ignore
const hiraganaCombosToRomaji: Record<string, string> = {
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo', 'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'しゃ': 'sya', 'しゅ': 'syu', 'しょ': 'syo', 'じゃ': 'zya', 'じゅ': 'zyu', 'じょ': 'zyo',
  'ちゃ': 'tsya', 'ちゅ': 'tsyu', 'ちょ': 'tsyo', 'ぢゃ': 'zya', 'ぢゅ': 'zyu', 'ぢょ': 'zyo',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo', 'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'うぁ': 'wa', 'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo',
  'ゔぁ': 'bva', 'ゔぃ': 'bvi', 'ゔぇ': 'bve', 'ゔぉ': 'bvo',
}
const tableToKatakana = (table: Record<string, string>): Record<string, string> => {
  const katakanaTable: Record<string, string> = {}
  for (const [hiragana, romaji] of Object.entries(table)) {
    const katakana = String.fromCharCode(hiragana.charCodeAt(0) + 96) // Convert hiragana to katakana by adding 96 to the char code
    katakanaTable[katakana] = romaji
  }
  return katakanaTable
}

const singleKanaToRomaji: Record<string, string> = {
  ...singleHiraganaToRomaji,
  ...tableToKatakana(singleHiraganaToRomaji),
}
const kanaCombosToRomaji: Record<string, string> = {
  ...hiraganaCombosToRomaji,
  ...tableToKatakana(hiraganaCombosToRomaji),
}

export function toRomaji(kana: string): string {
  let romaji = ''
  // Go through each kana and check for combos, then single character matches.
  // if a sokuon or choonpu is found, repeat any vowel before it.
  for (let i = 0; i < kana.length; i++) {
    const char = kana[i]
    if (char === 'ー') {
      // Choonpu (long vowel mark) - repeat the last vowel
      if (romaji.length > 0) {
        const lastChar = romaji[romaji.length - 1]
        if (lastChar.match(/[aeiou]/)) {
          romaji += lastChar // Repeat the last vowel
        }
      }
    } else if (char === 'っ') {
      // Sokuon (small tsu) - repeat the last consonant
      if (romaji.length > 0) {
        const lastChar = romaji[romaji.length - 1]
        if (lastChar.match(/[bcdfghjklmnpqrstvwxyz]/)) {
          romaji += lastChar // Repeat the last consonant
        }
      }
    } else if (kanaCombosToRomaji[char + kana[i + 1]]) {
      romaji += kanaCombosToRomaji[char + kana[i + 1]]
      i++ // Skip the next character
    } else {
      romaji += singleKanaToRomaji[char] || char
    }
  }
  // Replace "ou" with "oo" and "ei" with "ee"
  romaji = romaji.replace(/ou/g, 'oo').replace(/ei/g, 'ee')
  return romaji
}
