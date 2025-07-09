import { getRegionsByMatchStatus } from './getRegionsByMatchStatus'
import { preprocessBaseTextSegments } from './preprocessBaseTextSegments'
import { findMatches, continueFindingMatches } from './findMatches'
import { alignSegmentCombinationsWithinRegions } from './alignSegmentCombinationsWithinRegions'
import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'
import { pickUpStragglers } from './pickUpStragglers'
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

export function syncTranscriptWithSubtitles(options: {
  /** the base text already segmented (e.g. according to a bilingual alignment) */
  baseTextSegments: BaseTextSegment[]
  /** segments of automatic text-to-speech output, from which timing can be derived */
  ttsSegments: UnnormalizedTextToSpeechSegment[]
  /** a regular expression for breaking base text segments into smaller chunks
   * which can be matched against subtitles */
  baseTextSubsegmenter: RegExp
  normalizeBaseTextSubsegment?: (text: string) => string
  normalizeTtsSegment?: (text: string) => string
}) {
  const {
    baseTextSegments,
    ttsSegments: ttsSegmentsInput,
    baseTextSubsegmenter,
    normalizeBaseTextSubsegment = defaultNormalizeJapanese,
    normalizeTtsSegment = defaultNormalizeJapanese,
  } = options
  const ttsSegments: TextToSpeechSegment[] = ttsSegmentsInput.map((segment, index) => ({
    text: segment.text,
    normalizedText: normalizeTtsSegment(segment.text),
    index,
  }))

  const subsegments = preprocessBaseTextSegments(baseTextSegments, baseTextSubsegmenter, normalizeBaseTextSubsegment)

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
    baseTextSegments: baseTextSegments,
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
    { minMatchLength: 11, levenshteinThreshold: 0 },
    { minMatchLength: 11, levenshteinThreshold: 0 },
    { minMatchLength: 10, levenshteinThreshold: 0 },
    { minMatchLength: 9, levenshteinThreshold: 0 },
    { minMatchLength: 8, levenshteinThreshold: 0 },
    { minMatchLength: 7, levenshteinThreshold: 0 },
    { minMatchLength: 6, levenshteinThreshold: 0 },
    //
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
    //
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
    //
    { minMatchLength: 15, levenshteinThreshold: 3 },
    { minMatchLength: 14, levenshteinThreshold: 3 },
    { minMatchLength: 13, levenshteinThreshold: 3 },
    { minMatchLength: 12, levenshteinThreshold: 3 },
    { minMatchLength: 11, levenshteinThreshold: 3 },
    { minMatchLength: 10, levenshteinThreshold: 3 },
    { minMatchLength: 9, levenshteinThreshold: 3 },
    { minMatchLength: 8, levenshteinThreshold: 3 },
    //
    { minMatchLength: 4, levenshteinThreshold: 1 },
    { minMatchLength: 3, levenshteinThreshold: 1 },
    { minMatchLength: 2, levenshteinThreshold: 1 },
  ]

  for (const { minMatchLength, levenshteinThreshold } of passesConfig) {
    latestPass = continueFindingMatches({
      baseTextSegments,
      baseTextSubsegments: subsegments,
      ttsSegments,
      regionsSoFar: latestPass.regions,
      minMatchLength,
      levenshteinThreshold,
      pass: String(+pass + 1),
    })
  }

  // at this point, only a small portion of unmatched regions remain.
  // within these regions, now we can try combining adjacent segments
  // and seeing how that affects levenshtein distance.
  //
  // maybe one way to do it:
  // start by choosing the *side* (base or tts) of the unmatched region
  // within which to combine a couple segments within.
  // you can choose by seeing which combination
  // produces a more even size for the first segments
  // in each side.
  // perhaps you can start from the top, and then the bottom, alternating up and down
  // since the top and bottom edges are going to be
  // easier to find fortuitous segment combinations in.
  //
  // one kind of easy case
  // is when there are no TTS segments in an unmatched region
  // and a short word or two is left straggling in the base text.
  // in this case, we can often find which matched segment
  // before or after has a improved levenshtein distance
  // if we combine the unmatched segment with the matched one.
  //
  //
  // finally, all unmatched regions will probably be very short,
  // so they will likely be already aligned, with either
  // strange spelling in the base text or inaccurate TTS results.

  for (let i = 0; i < 4; i++) {
    const afterAligningEnds = alignSegmentCombinationsWithinRegions({
      regions: latestPass.regions,
      baseTextSubsegments: subsegments,
      ttsSegments,
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

  return {
    ...latestPass,

    baseTextSubsegments: subsegments,
    getBaseTextSubsegmentText,
    getTtsSegmentText,
  }
}
