import { parseSrt } from './srtHelpers'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'

export function alignWithSrt(transcriptText: string, srtText: string) {
  const syncResult = syncTranscriptWithSubtitles({
    baseTextSegments: singleTranscriptSegmentInput(transcriptText),
    ttsSegments: parseSrt(srtText).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
      normalizedText: defaultNormalize(typeof n.data === 'string' ? n.data : n.data.text),
    })),
    baseTextSubsegmenter: getJapaneseSubsegmenter(),
  })

  return syncResult
}

function getJapaneseSubsegmenter() {
  return /[^\s。？、！―]+[\s。？、！―]+[」』]*|[^\s。？」、！』―]+[\s。？、！―」』]*$/gu
}

const singleTranscriptSegmentInput = (text: string) => [{ text, normalizedText: defaultNormalize(text), index: 0 }]
export const defaultNormalize = (text: string): string =>
  text
    .replace(/[『「\s。？」、！』―]+/g, '')
    .trim()
    .toLowerCase()
