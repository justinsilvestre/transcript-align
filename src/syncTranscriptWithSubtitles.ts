import { getRegionsByMatchStatus, MatchStatusRegion } from './getRegionsByMatchStatus'
import { preprocessBaseTextSegments } from './preprocessBaseTextSegments'
import { findMatches, continueFindingMatches } from './findMatches'
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

export type BaseTextSubsegmentMatchResult = MatchedBaseTextSubsegment | UnmatchedBaseTextSubsegment
export type MatchedBaseTextSubsegment = {
  baseTextSubsegmentIndex: number
  baseTextSegmentIndex: number
  ttsSegmentIndex: number
  matchParameters: {
    passNumber: number
    minMatchLength: number
    levenshteinThreshold: number
  }
}
export type UnmatchedBaseTextSubsegment = {
  baseTextSubsegmentIndex: number
  baseTextSegmentIndex: number
  ttsSegmentIndex: null
}

type AlignmentPassParameters = {
  passNumber: number
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
    normalizeBaseTextSubsegment = defaultNormalize,
    normalizeTtsSegment = defaultNormalize,
  } = options
  const ttsSegments: TextToSpeechSegment[] = ttsSegmentsInput.map((segment, index) => ({
    text: segment.text,
    normalizedText: normalizeTtsSegment(segment.text),
    index,
  }))
  const subsegments = preprocessBaseTextSegments(baseTextSegments, baseTextSubsegmenter, normalizeBaseTextSubsegment)

  const firstPass = findMatches({
    baseTextSubsegments: subsegments,
    baseTextSegments: baseTextSegments,
    ttsSegments: ttsSegments,
    passNumber: 1,
    minMatchLength: 15,
    levenshteinThreshold: 2,
    baseTextSubsegmentsStartIndex: 0,
    baseTextSubsegmentsEnd: subsegments.length,
    ttsSegmentsStartIndex: 0,
    ttsSegmentsEnd: ttsSegments.length,
  })
  let latestPass = {
    results: firstPass.results,
    regions: getRegionsByMatchStatus(firstPass.results, ttsSegments.length),
  }

  let passNumber = 1

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
      // resultsSoFar: latestPass,
      regionsSoFar: latestPass.regions,
      minMatchLength,
      levenshteinThreshold,
      passNumber: ++passNumber,
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

  // align the ends of regions here,
  // something like this:
  // const afterAligningEnds = alignRegionEnds({
  //   regions: latestPass.regions,
  //   getBaseTextSubsegmentText: firstPass.getBaseTextSubsegmentText,
  //   getTtsSegmentText: firstPass.getTtsSegmentText,
  //   baseTextSubsegments: subsegments,
  //   ttsSegments,
  //   minMatchLength: 15,
  //   levenshteinThreshold: 2,
  // })
  // latestPass.regions = getRegionsByMatchStatus(afterAligningEnds, ttsSegments.length)
  // latestPass.results = afterAligningEnds

  return {
    ...latestPass,

    getBaseTextSubsegmentText: firstPass.getBaseTextSubsegmentText,
    getTtsSegmentText: firstPass.getTtsSegmentText,
  }
}

function alignRegionEnds(options: {
  regions: MatchStatusRegion[]
  getBaseTextSubsegmentText: (sourceIndex: number, index: number) => string
  getTtsSegmentText: (index: number) => string
  minMatchLength: number
  levenshteinThreshold: number
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
}) {
  const {
    regions,
    getBaseTextSubsegmentText,
    getTtsSegmentText,
    minMatchLength,
    levenshteinThreshold,
    baseTextSubsegments,
    ttsSegments,
  } = options
  const newResults: BaseTextSubsegmentMatchResult[] = []

  for (const region of regions) {
    if (region.isMatching) {
      newResults.push(...region.results)
      continue
    }
    // if the region has just 1 base text subsegment and 1 tts segment,
    // no need for further processing.
    if (region.results.length === 1 && region.ttsSegments.start === region.ttsSegments.end - 1) {
      newResults.push(...region.results)
      continue
    }

    // now the previous region is a matching one,
    // and this region is an unmatched one.

    // get the levenshtein distance between this region's first subsegment and ttsSegment.
    // then see if adding either the next base text subsegment or the next ttsSegment
    // improves the levenshtein distance.
    // keep doing this for both sides until the levenshtein distance
    // is no longer improved by adding more segments.

    // then, start the process again,
    // but this time, start from the end of the region,
  }

  return newResults
}

function defaultNormalize(text: string): string {
  return (
    text
      .replace(/[\s。？」、！』―]+/g, '')
      // replace katakana with hiragana
      .replace(/[\u30A1-\u30F6]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 96))
      // replace Chinese numerals with Arabic numerals
      .replace(/[\u4E00-\u9FA5]/g, (match) => {
        const charCode = match.charCodeAt(0)
        if (charCode >= 0x4e00 && charCode <= 0x9fa5) {
          // Convert Chinese numeral to Arabic numeral
          return String.fromCharCode(charCode - 0x4e00 + 0x0030)
        }
        return match
      })
      .trim()
      .toLowerCase()
  )
}
