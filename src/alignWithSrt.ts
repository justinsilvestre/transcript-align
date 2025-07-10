import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'
import { parseSrt, parseSrtCues } from './srtHelpers'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'

export type AlignmentResult = ReturnType<typeof alignWithSrt>

export function alignWithSrt(transcriptText: string, srtText: string) {
  const singleTranscriptSegmentInput = (text: string) => [
    { text, normalizedText: defaultNormalizeJapanese(text), index: 0 },
  ]

  const syncResult = syncTranscriptWithSubtitles({
    baseTextSegments: singleTranscriptSegmentInput(transcriptText),
    ttsSegments: parseSrtCues(srtText).map((n, i) => ({
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
