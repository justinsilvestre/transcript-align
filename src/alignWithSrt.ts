import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'
import { parseSrt, parseSrtCues } from './srtHelpers'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'

export type AlignmentResult = Awaited<ReturnType<typeof alignWithSrt>>

export async function alignWithSrt(
  transcriptText: string,
  srtText: string,
  options: {
    normalizeBaseTextSubsegment?: (text: string) => Promise<string>
    normalizeTtsSegment?: (text: string) => Promise<string>
  } = {},
) {
  const singleTranscriptSegmentInput = (text: string) => [
    { text, normalizedText: defaultNormalizeJapanese(text), index: 0 },
  ]

  const syncResult = await syncTranscriptWithSubtitles({
    baseTextSegments: singleTranscriptSegmentInput(transcriptText),
    ttsSegments: parseSrtCues(srtText).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    })),
    baseTextSubsegmenter: getJapaneseSubsegmenter(),
    normalizeBaseTextSubsegment: options.normalizeBaseTextSubsegment || defaultNormalizeJapanese,
    normalizeTtsSegment: options.normalizeTtsSegment || defaultNormalizeJapanese,
  })

  return syncResult
}

function getJapaneseSubsegmenter() {
  return /([^\s。？、！―]+[\s。？、！―]+([」』]+[\s]*)*)|([^\s。？」、！』―]+[\s。？、！―」』]*$)/gu
}
