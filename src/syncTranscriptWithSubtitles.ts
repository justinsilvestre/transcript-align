import * as levenshtein from 'fast-levenshtein'
import { findIndexBetween } from './findIndexBetween'
type BaseTextSegment = {
  index: number
  text: string
}
type BaseTextSubsegment = {
  /** index of BaseTextSegment */
  segmentIndex: number
  /** index of the subsegment within the BaseTextSegment */
  indexInSource: number
  /** index with respect to all BaseTextSubsegments */
  subsegmentIndex: number
  text: string
  normalizedText: string
}
type TextToSpeechSegment = {
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

  return {
    ...latestPass,

    getBaseTextSubsegmentText: firstPass.getBaseTextSubsegmentText,
    getTtsSegmentText: firstPass.getTtsSegmentText,
  }
}

function alignRegionEnds(options: {
  resultsSoFar: BaseTextSubsegmentMatchResult[]
  getBaseTextSubsegmentText: (sourceIndex: number, index: number) => string
  getTtsSegmentText: (index: number) => string
  minMatchLength: number
  levenshteinThreshold: number
}) {
  //
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

export function preprocessBaseTextSegments(
  baseTextSegments: BaseTextSegment[],
  baseTextSubsegmenter: RegExp,
  normalizeBaseTextSubsegment: (text: string) => string,
): BaseTextSubsegment[] {
  let subsegmentIndex = 0
  return baseTextSegments.flatMap((segment): BaseTextSubsegment[] => {
    if (!segment.text)
      return [
        {
          segmentIndex: segment.index,
          indexInSource: 0,
          subsegmentIndex: subsegmentIndex++,
          text: '',
          normalizedText: '',
        },
      ]

    const subsegments = segment.text.match(baseTextSubsegmenter)
    if (!subsegments) throw new Error(`No matches found for segment: ${segment.text}`)
    return subsegments.map((text, index) => ({
      segmentIndex: segment.index,
      indexInSource: index,
      subsegmentIndex: subsegmentIndex++,
      text,
      normalizedText: normalizeBaseTextSubsegment(text),
    }))
  })
}

export function findMatches(options: {
  baseTextSubsegments: BaseTextSubsegment[]
  baseTextSegments: BaseTextSegment[]
  ttsSegments: TextToSpeechSegment[]
  minMatchLength: number
  levenshteinThreshold: number
  passNumber: number
  baseTextSubsegmentsStartIndex: number
  baseTextSubsegmentsEnd: number
  ttsSegmentsStartIndex: number
  ttsSegmentsEnd: number
}) {
  const {
    baseTextSubsegments,
    baseTextSegments,
    ttsSegments,
    minMatchLength,
    levenshteinThreshold,
    passNumber,
    baseTextSubsegmentsStartIndex,
    baseTextSubsegmentsEnd,
    ttsSegmentsStartIndex,
    ttsSegmentsEnd,
  } = options
  const matchParameters = {
    minMatchLength,
    levenshteinThreshold,
    passNumber,
  }

  const results: BaseTextSubsegmentMatchResult[] = []

  let searchStartIndex = ttsSegmentsStartIndex

  for (
    let baseTextSubsegmentIndex = baseTextSubsegmentsStartIndex;
    baseTextSubsegmentIndex < baseTextSubsegmentsEnd;
    baseTextSubsegmentIndex++
  ) {
    const subsegment = baseTextSubsegments[baseTextSubsegmentIndex]
    if (!subsegment) {
      console.warn(
        `No base text subsegment found at index ${baseTextSubsegmentIndex}, skipping. length of baseTextSubsegments: ${baseTextSubsegments.length}`,
      )
      continue
    }
    const normalizedSubsegmentText = subsegment.normalizedText
    const ttsSegmentMatchIndex =
      normalizedSubsegmentText.length >= minMatchLength
        ? findIndexBetween(ttsSegments, searchStartIndex, ttsSegmentsEnd, (ttsSegment) => {
            const normalizedTtsSegmentText = ttsSegment.normalizedText
            const distance = levenshtein.get(normalizedSubsegmentText, normalizedTtsSegmentText)
            return distance <= levenshteinThreshold
          })
        : -1

    const matchFound = ttsSegmentMatchIndex !== -1

    if (matchFound) {
      searchStartIndex = ttsSegmentMatchIndex + 1
      results.push({
        baseTextSubsegmentIndex: subsegment.subsegmentIndex,
        baseTextSegmentIndex: subsegment.segmentIndex,
        ttsSegmentIndex: ttsSegments[ttsSegmentMatchIndex].index,
        matchParameters,
      })
    } else {
      results.push({
        baseTextSubsegmentIndex: subsegment.subsegmentIndex,
        baseTextSegmentIndex: subsegment.segmentIndex,
        ttsSegmentIndex: null,
      })
    }
  }

  return {
    results,
    getBaseTextSubsegmentText: (sourceIndex: number, index: number) => {
      const subsegment = baseTextSubsegments.find((s) => s.segmentIndex === sourceIndex && s.indexInSource === index)
      if (!subsegment) throw new Error(`No base text subsegment found at sourceIndex ${sourceIndex}, index ${index}`)
      return subsegment.text
    },
    getTtsSegmentText: (index: number) => {
      const ttsSegment = ttsSegments[index]
      if (!ttsSegment) throw new Error(`No TTS segment found at index ${index}`)
      return ttsSegment.text
    },
  }
}

function continueFindingMatches(options: {
  baseTextSegments: BaseTextSegment[]
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]

  regionsSoFar: MatchStatusRegion[]
  minMatchLength: number
  levenshteinThreshold: number
  passNumber?: number
}) {
  const {
    baseTextSegments,
    baseTextSubsegments,
    ttsSegments,
    regionsSoFar: regions,
    minMatchLength,
    levenshteinThreshold,
    passNumber = 1,
  } = options

  const newMatchResults: BaseTextSubsegmentMatchResult[] = []

  let regionIndex = 0
  for (const region of regions) {
    if (region.isMatching) {
      for (const match of region.results || []) {
        newMatchResults.push(match)
      }
    } else {
      const previousRegion = regions[regionIndex - 1]
      if (previousRegion && !previousRegion.isMatching)
        throw new Error('Cannot continue finding matches without a matching region before an unmatched one.')
      const nextRegion = regions[regionIndex + 1]
      if (nextRegion && !nextRegion.isMatching)
        throw new Error('Cannot continue finding matches without a matching region after an unmatched one.')
      const { results } = findMatches({
        baseTextSubsegments: baseTextSubsegments,
        baseTextSegments: baseTextSegments,
        ttsSegments: ttsSegments,
        minMatchLength,
        levenshteinThreshold,
        passNumber,
        baseTextSubsegmentsStartIndex: region.subsegments.start,
        baseTextSubsegmentsEnd: region.subsegments.end,
        ttsSegmentsStartIndex: previousRegion ? previousRegion.ttsSegments.end : 0,
        ttsSegmentsEnd: nextRegion ? nextRegion.ttsSegments.start : ttsSegments.length,
      })
      newMatchResults.push(...results)
    }
    regionIndex++
  }
  return {
    results: newMatchResults,
    regions: getRegionsByMatchStatus(newMatchResults, ttsSegments.length),
  }
}

/** Uses BaseTextSubsegment absolute indexes */
type MatchStatusRegion =
  | {
      subsegments: { start: number; end: number }
      ttsSegments: { start: number; end: number }
      isMatching: true
      results: MatchedBaseTextSubsegment[]
    }
  | {
      subsegments: { start: number; end: number }
      ttsSegments: { start: number; end: number }
      isMatching: false
      results: UnmatchedBaseTextSubsegment[]
    }

function isMatch(result: BaseTextSubsegmentMatchResult): result is MatchedBaseTextSubsegment {
  return result.ttsSegmentIndex !== null
}

export function getRegionsByMatchStatus(results: BaseTextSubsegmentMatchResult[], ttsSegmentsCount: number) {
  const regions: MatchStatusRegion[] = []

  for (let i = 0; i < results.length; i++) {
    const previousResult = results[i - 1]
    const currentResult = results[i]
    if (!previousResult) {
      regions.push(
        isMatch(currentResult)
          ? {
              subsegments: {
                start: currentResult.baseTextSubsegmentIndex,
                end: currentResult.baseTextSubsegmentIndex + 1,
              },
              ttsSegments: { start: currentResult.ttsSegmentIndex, end: currentResult.ttsSegmentIndex + 1 },
              isMatching: true,
              results: [currentResult],
            }
          : {
              subsegments: {
                start: currentResult.baseTextSubsegmentIndex,
                end: currentResult.baseTextSubsegmentIndex + 1,
              },
              ttsSegments: { start: -1, end: -1 }, // to be filled in below
              isMatching: false,
              results: [currentResult],
            },
      )
    } else if (isMatch(currentResult)) {
      const currentRegion = regions[regions.length - 1]
      if (currentRegion.isMatching) {
        currentRegion.subsegments.end = currentResult.baseTextSubsegmentIndex + 1
        currentRegion.ttsSegments.end = currentResult.ttsSegmentIndex + 1
        currentRegion.results.push(currentResult)
      } else {
        regions.push({
          subsegments: {
            start: currentResult.baseTextSubsegmentIndex,
            end: currentResult.baseTextSubsegmentIndex + 1,
          },
          ttsSegments: { start: currentResult.ttsSegmentIndex, end: currentResult.ttsSegmentIndex + 1 },
          isMatching: true,
          results: [currentResult],
        })
      }
    } else {
      const currentRegion = regions[regions.length - 1]
      if (currentRegion.isMatching) {
        regions.push({
          subsegments: {
            start: currentResult.baseTextSubsegmentIndex,
            end: currentResult.baseTextSubsegmentIndex + 1,
          },
          ttsSegments: { start: -1, end: -1 }, // to be filled in below
          isMatching: false,
          results: [currentResult],
        })
      } else {
        currentRegion.subsegments.end = currentResult.baseTextSubsegmentIndex + 1
        currentRegion.results.push(currentResult)
      }
    }
  }

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]
    if (region.isMatching) continue
    const previousRegion = regions[i - 1]
    const nextRegion = regions[i + 1]
    region.ttsSegments.start = previousRegion ? previousRegion.ttsSegments.end : 0
    region.ttsSegments.end = nextRegion ? nextRegion.ttsSegments.start : ttsSegmentsCount
  }

  return regions
}
