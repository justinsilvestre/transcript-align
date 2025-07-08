import * as levenshtein from 'fast-levenshtein'
import { findIndexBetween } from './findIndexBetween'
import { MatchStatusRegion, getRegionsByMatchStatus } from './getRegionsByMatchStatus'
import {
  BaseTextSubsegment,
  BaseTextSegment,
  TextToSpeechSegment,
  BaseTextSubsegmentMatchResult,
} from './syncTranscriptWithSubtitles'

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
export function continueFindingMatches(options: {
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
