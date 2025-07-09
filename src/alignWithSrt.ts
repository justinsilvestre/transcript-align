import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'
import { parseSrt } from './srtHelpers'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'

export function alignWithSrt(transcriptText: string, srtText: string) {
  const singleTranscriptSegmentInput = (text: string) => [
    { text, normalizedText: defaultNormalizeJapanese(text), index: 0 },
  ]

  const syncResult = syncTranscriptWithSubtitles({
    baseTextSegments: singleTranscriptSegmentInput(transcriptText),
    ttsSegments: parseSrt(srtText).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    })),
    baseTextSubsegmenter: getJapaneseSubsegmenter(),
    normalizeBaseTextSubsegment: defaultNormalizeJapanese,
    normalizeTtsSegment: defaultNormalizeJapanese,
  })

  return syncResult
}

function getJapaneseSubsegmenter() {
  return /([^\s。？、！―]+[\s。？、！―]+([」』]+[\s]*)*)|([^\s。？」、！』―]+[\s。？、！―」』]*$)/gu
}
