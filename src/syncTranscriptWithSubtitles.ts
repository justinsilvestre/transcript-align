import { getRegionsByMatchStatus } from './getRegionsByMatchStatus'
import { preprocessBaseTextSegments } from './preprocessBaseTextSegments'
import { findMatches, continueFindingMatches } from './findMatches'
import { alignSegmentCombinationsWithinRegions } from './alignSegmentCombinationsWithinRegions'
import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'
import { pickUpStragglers } from './pickUpStragglers'
import { NormalizeTextFunction } from './NormalizeTextFunction'
export type BaseTextSegment = {
  index: number
  text: string
}
export type BaseTextSubsegment = {
  /** index of BaseTextSegment */
  segmentIndex: number
  /** index of the subsegment within the BaseTextSegment */
  indexInSource: number
  /** index with respect to all BaseTextSubsegments */
  subsegmentIndex: number
  text: string
  normalizedText: string
}
export type TextToSpeechSegment = {
  text: string
  normalizedText: string
  index: number
}

type UnnormalizedTextToSpeechSegment = Omit<TextToSpeechSegment, 'normalizedText'>

export type BaseTextSubsegmentsMatchResult = MatchedBaseTextSubsegments | UnmatchedBaseTextSubsegment
export type MatchedBaseTextSubsegments = {
  subsegments: { start: number; end: number }
  ttsSegments: { start: number; end: number }
  matchParameters: {
    pass: string
    minMatchLength: number
    levenshteinThreshold: number
  }
}
export type UnmatchedBaseTextSubsegment = {
  baseTextSubsegmentIndex: number
  ttsSegmentIndex: null
}

type AlignmentPassParameters = {
  pass: string
  minMatchLength: number
  levenshteinThreshold: number
}

export async function syncTranscriptWithSubtitles(options: {
  /** the base text already segmented (e.g. according to a bilingual alignment) */
  baseTextSegments: BaseTextSegment[]
  /** segments of automatic text-to-speech output, from which timing can be derived */
  ttsSegments: UnnormalizedTextToSpeechSegment[]
  /** a regular expression for breaking base text segments into smaller chunks
   * which can be matched against subtitles */
  baseTextSubsegmenter: RegExp
  normalizeBaseTextSubsegment?: NormalizeTextFunction
  normalizeTtsSegment?: NormalizeTextFunction
}) {
  const {
    baseTextSegments,
    ttsSegments: ttsSegmentsInput,
    baseTextSubsegmenter,
    normalizeBaseTextSubsegment = defaultNormalizeJapanese,
    normalizeTtsSegment = defaultNormalizeJapanese,
  } = options
  const ttsSegments: TextToSpeechSegment[] = await Promise.all(
    ttsSegmentsInput.map(async (segment, index) => ({
      text: segment.text,
      normalizedText: await normalizeTtsSegment(segment.text),
      index,
    })),
  )

  const subsegments = await preprocessBaseTextSegments(
    baseTextSegments,
    baseTextSubsegmenter,
    normalizeBaseTextSubsegment,
  )

  const getBaseTextSubsegmentText = (index: number) => {
    const subsegment = subsegments.find((s) => s.subsegmentIndex === index)
    if (!subsegment) throw new Error(`No base text subsegment found at index ${index}`)
    return subsegment.text
  }
  const getTtsSegmentText = (index: number) => {
    const ttsSegment = ttsSegments[index]
    if (!ttsSegment) throw new Error(`No TTS segment found at index ${index}`)
    return ttsSegment.text
  }

  const firstPass = findMatches({
    baseTextSubsegments: subsegments,
    ttsSegments: ttsSegments,
    pass: '1',
    minMatchLength: 15,
    levenshteinThreshold: 2,
    baseTextSubsegmentsStartIndex: 0,
    baseTextSubsegmentsEnd: subsegments.length,
    ttsSegmentsStartIndex: 0,
    ttsSegmentsEnd: ttsSegments.length,
  })
  let latestPass = {
    results: firstPass,
    regions: getRegionsByMatchStatus(firstPass, ttsSegments.length),
  }

  let pass = 1

  // these numbers would be adjusted for different languages.
  // just doing Japanese for now.
  const passesConfig = [
    { minMatchLength: 15, levenshteinThreshold: 0 },
    { minMatchLength: 14, levenshteinThreshold: 0 },
    { minMatchLength: 13, levenshteinThreshold: 0 },
    { minMatchLength: 12, levenshteinThreshold: 0 },
    { minMatchLength: 11, levenshteinThreshold: 0 },
    { minMatchLength: 10, levenshteinThreshold: 0 },
    { minMatchLength: 9, levenshteinThreshold: 0 },
    { minMatchLength: 8, levenshteinThreshold: 0 },
    { minMatchLength: 7, levenshteinThreshold: 0 },
    { minMatchLength: 6, levenshteinThreshold: 0 },
    // //
    { minMatchLength: 15, levenshteinThreshold: 1 },
    { minMatchLength: 14, levenshteinThreshold: 1 },
    { minMatchLength: 13, levenshteinThreshold: 1 },
    { minMatchLength: 12, levenshteinThreshold: 1 },
    { minMatchLength: 11, levenshteinThreshold: 1 },
    { minMatchLength: 10, levenshteinThreshold: 1 },
    { minMatchLength: 9, levenshteinThreshold: 1 },
    { minMatchLength: 8, levenshteinThreshold: 1 },
    { minMatchLength: 7, levenshteinThreshold: 1 },
    { minMatchLength: 6, levenshteinThreshold: 1 },
    // // //
    { minMatchLength: 15, levenshteinThreshold: 2 },
    { minMatchLength: 14, levenshteinThreshold: 2 },
    { minMatchLength: 13, levenshteinThreshold: 2 },
    { minMatchLength: 12, levenshteinThreshold: 2 },
    { minMatchLength: 11, levenshteinThreshold: 2 },
    { minMatchLength: 10, levenshteinThreshold: 2 },
    { minMatchLength: 9, levenshteinThreshold: 2 },
    { minMatchLength: 8, levenshteinThreshold: 2 },
    { minMatchLength: 7, levenshteinThreshold: 2 },
    { minMatchLength: 6, levenshteinThreshold: 2 },
    { minMatchLength: 5, levenshteinThreshold: 2 },
    // //
    { minMatchLength: 15, levenshteinThreshold: 3 },
    { minMatchLength: 14, levenshteinThreshold: 3 },
    { minMatchLength: 13, levenshteinThreshold: 3 },
    { minMatchLength: 12, levenshteinThreshold: 3 },
    { minMatchLength: 11, levenshteinThreshold: 3 },
    { minMatchLength: 10, levenshteinThreshold: 3 },
    { minMatchLength: 9, levenshteinThreshold: 3 },
    { minMatchLength: 8, levenshteinThreshold: 3 },

    { minMatchLength: 4, levenshteinThreshold: 1 },
    { minMatchLength: 3, levenshteinThreshold: 1 },
    { minMatchLength: 2, levenshteinThreshold: 1 },
  ]

  for (const { minMatchLength, levenshteinThreshold } of passesConfig) {
    latestPass = continueFindingMatches({
      baseTextSubsegments: subsegments,
      ttsSegments,
      regionsSoFar: latestPass.regions,
      minMatchLength,
      levenshteinThreshold,
      pass: String(+pass + 1),
    })

    for (let i = 0; i < 4; i++) {
      const afterAligningEnds = alignSegmentCombinationsWithinRegions({
        regions: latestPass.regions,
        baseTextSubsegments: subsegments,
        ttsSegments,
        similarityThreshold: 0.8 - i * 0.1,
      })
      latestPass.regions = getRegionsByMatchStatus(afterAligningEnds, ttsSegments.length)
      latestPass.results = afterAligningEnds

      const afterPickingUpStragglers = pickUpStragglers({
        baseTextSubsegments: subsegments,
        ttsSegments,
        regions: latestPass.regions,
      })
      latestPass.regions = getRegionsByMatchStatus(afterPickingUpStragglers, ttsSegments.length)
      latestPass.results = afterPickingUpStragglers
    }
  }

  return {
    ...latestPass,

    baseTextSubsegments: subsegments,
    getBaseTextSubsegmentText,
    getTtsSegmentText,
  }
}
