import { describe, expect, it } from 'vitest'
import { isLevenshteinImprovement } from './isLevenshteinImprovement'
import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'

describe('isLevenshteinImprovement', () => {
  const improvementCase = (text: string, tentativeTextToAppend: string, comparisonBaseText: string) => ({
    text: text,
    tentativeTextToAppend: tentativeTextToAppend,
    comparisonBaseText: comparisonBaseText,
  })
  const improvementCases = [
    improvementCase('こんにちは', '世界', 'こんにちは世界'),
    improvementCase('夕闇と共に遠慮なく、', '吹きぬける。', '夕闇とともに遠慮なく 吹き抜ける'),
    improvementCase('老婆は、', '一目下人を見ると、', '老婆は一目下 人を見ると'),
    improvementCase('しかし勝敗は、', 'はじめからわかっている。', 'しかし 勝敗は初めからわかっている'),
    improvementCase('しかし、', '下人は雨がやんでも、', 'しかし 芸人は雨が止んでも'),
    improvementCase('上では', '誰か 火を点して', '上では誰か火をとぼして'),
    // improvementCase(
    //   '山吹のかざみに重ねた 紺の青の肩を高くして',
    //   '文の周りを見回した',
    //   '紺の襖の肩を高くして門のまわりを見まわした。',
    // ),
    improvementCase(
      '丹塗の柱にとまっていた蟋蟀も、',
      'もうどこかへ行ってしまった。',
      '丹塗りの柱にとまっていた きりぎりす ももうどこかへ行ってしまった。',
    ),
    improvementCase('上なら、', '人がいたにしても、', '上なら人がいたとしても'),
    improvementCase('abc', 'defghijk', 'abcdefghijk'),
    improvementCase(
      'そこで 2人は何をおいても さしあたり 明日の暮らしをどうに',
      '何かしようとして',
      '何をおいても差当り明日の暮しをどうにかしようとして――',
    ),
    improvementCase(
      'そのくらいな事を、',
      'されてもいい人間ばかりだぞよ。',
      '皆そのくらいなことをされてもいい人間ばかりだぞよ',
    ),
    improvementCase('神は', '手に従って抜けるらしい', '髪は手に従って抜けるらしい。 '),
  ]
  const worseningCase = (text: string, tentativeTextToAppend: string, comparisonBaseText: string) => ({
    text: text,
    tentativeTextToAppend: tentativeTextToAppend,
    comparisonBaseText: comparisonBaseText,
  })
  const worseningCases = [
    worseningCase('こんにちは', '世界', 'こんにちは'),
    worseningCase('一本ずつ抜き始めた', '神は', '猿の親が猿の子の虱をとるように、'),
    worseningCase('ABCDEFDGHIJKLEM', 'NOM', 'PQRSgMPQRTQRURERVDWRRQI'),
    worseningCase('この時、', '誰かがこの下人に、', '一分ごとに強さを増してきたのである'),
  ]

  for (const { text, tentativeTextToAppend, comparisonBaseText } of improvementCases) {
    it('returns true when the addition is an improvement: ' + text, () => {
      const result = isLevenshteinImprovement(
        defaultNormalizeJapanese(text),
        defaultNormalizeJapanese(tentativeTextToAppend),
        defaultNormalizeJapanese(comparisonBaseText),
      )
      expect(result).toBe(true)
    })
  }

  for (const { text, tentativeTextToAppend, comparisonBaseText } of worseningCases) {
    it('returns false when the addition is not an improvement: ' + text, () => {
      const result = isLevenshteinImprovement(
        defaultNormalizeJapanese(text),
        defaultNormalizeJapanese(tentativeTextToAppend),
        defaultNormalizeJapanese(comparisonBaseText),
        true,
      )
      expect(result).toBe(false)
    })
  }
})
