import * as levenshtein from 'fast-levenshtein'
import { findIndexBetween } from './findIndexBetween'
import { MatchStatusRegion, getRegionsByMatchStatus, isMatch } from './getRegionsByMatchStatus'
import {
  BaseTextSubsegment,
  BaseTextSegment,
  TextToSpeechSegment,
  BaseTextSubsegmentsMatchResult,
} from './syncTranscriptWithSubtitles'

export function findMatches(options: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  minMatchLength: number
  levenshteinThreshold: number
  pass: string
  baseTextSubsegmentsStartIndex: number
  baseTextSubsegmentsEnd: number
  ttsSegmentsStartIndex: number
  ttsSegmentsEnd: number
}) {
  const {
    baseTextSubsegments,
    ttsSegments,
    minMatchLength,
    levenshteinThreshold,
    pass,
    baseTextSubsegmentsStartIndex,
    baseTextSubsegmentsEnd,
    ttsSegmentsStartIndex,
    ttsSegmentsEnd,
  } = options
  const matchParameters = {
    minMatchLength,
    levenshteinThreshold,
    pass,
  }

  const results: BaseTextSubsegmentsMatchResult[] = []

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
      // searchStartIndex = ttsSegmentMatchIndex + 1
      results.push({
        subsegments: {
          start: subsegment.subsegmentIndex,
          end: subsegment.subsegmentIndex + 1,
        },
        ttsSegments: {
          start: ttsSegments[ttsSegmentMatchIndex].index,
          end: ttsSegments[ttsSegmentMatchIndex].index + 1,
        },
        matchParameters,
      })
    } else {
      results.push({
        baseTextSubsegmentIndex: subsegment.subsegmentIndex,
        ttsSegmentIndex: null,
      })
    }
  }

  return results
}
export function continueFindingMatches(options: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  regionsSoFar: MatchStatusRegion[]
  minMatchLength: number
  levenshteinThreshold: number
  pass?: string
}) {
  const {
    baseTextSubsegments,
    ttsSegments,
    regionsSoFar: regions,
    minMatchLength,
    levenshteinThreshold,
    pass = '1',
  } = options

  const newMatchResults: BaseTextSubsegmentsMatchResult[] = []

  let regionIndex = 0
  for (const region of regions) {
    if (region.isMatching) {
      newMatchResults.push(...region.results)
    } else {
      const previousRegion = regions[regionIndex - 1]
      if (previousRegion && !previousRegion.isMatching)
        throw new Error('Cannot continue finding matches without a matching region before an unmatched one.')
      const nextRegion = regions[regionIndex + 1]
      if (nextRegion && !nextRegion.isMatching)
        throw new Error('Cannot continue finding matches without a matching region after an unmatched one.')
      const results = findMatches({
        baseTextSubsegments: baseTextSubsegments,
        ttsSegments: ttsSegments,
        minMatchLength,
        levenshteinThreshold,
        pass,
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

function getMatchResultElements(
  baseTextSubsegments: BaseTextSubsegment[],
  ttsSegments: TextToSpeechSegment[],
  matchResult: BaseTextSubsegmentsMatchResult,
) {
  if (isMatch(matchResult)) {
    const baseText = getElementsInRange(baseTextSubsegments, matchResult.subsegments)
    const ttsText = getElementsInRange(ttsSegments, matchResult.ttsSegments)
    return { baseText, ttsText }
  } else {
    return {
      baseText: [baseTextSubsegments[matchResult.baseTextSubsegmentIndex]],
      ttsText: [],
    }
  }
}
function getElementsInRange<T>(elements: T[], range: { start: number; end: number }): T[] {
  return elements.slice(range.start, range.end)
}
