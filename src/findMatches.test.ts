import { describe, it, expect } from 'vitest'
import { continueFindingMatches } from './findMatches'
import {
  BaseTextSegment,
  BaseTextSubsegment,
  MatchedBaseTextSubsegments,
  TextToSpeechSegment,
  UnmatchedBaseTextSubsegment,
} from './syncTranscriptWithSubtitles'
import { getRegionsByMatchStatus, MatchStatusRegion } from './getRegionsByMatchStatus'

describe('continueFindingMatches', () => {
  it('should return the same regions if no new matches are found', () => {
    const baseTextSubsegments: BaseTextSubsegment[] = [
      subsegment(0, 'This is a test.'),
      subsegment(1, 'Another test segment.'),
      subsegment(2, 'Final segment for testing.'),
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      ttsSegment(0, 'This is a test.'),
      ttsSegment(1, 'Another test segment.'),
      ttsSegment(2, 'Final segment for testing.'),
      ttsSegment(3, 'This segment does not match.'),
    ]
    const regionsSoFar = getRegionsByMatchStatus(
      [
        matchedSubsegments([0, 1], [0, 1]),
        matchedSubsegments([1, 2], [1, 2]),
        matchedSubsegments([2, 3], [2, 3]),
        matchedSubsegments([3, 4], [3, 4]),
      ],
      ttsSegments.length,
    )

    const minMatchLength = 11
    const levenshteinThreshold = 0

    const result = continueFindingMatches({
      baseTextSubsegments,
      ttsSegments,
      regionsSoFar,
      minMatchLength,
      levenshteinThreshold,
    })

    expect(result.regions).toEqual(regionsSoFar)
  })

  it('should find new matches and return updated regions', () => {
    const baseTextSubsegments: BaseTextSubsegment[] = [
      subsegment(0, 'This is a test.'),
      subsegment(1, 'Another test segment.'),
      subsegment(2, 'Final segment for testing.'),
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      ttsSegment(0, 'This is a test.'),
      ttsSegment(1, 'Another test segment.'),
      ttsSegment(2, 'Final segment for testing.'),
      ttsSegment(3, 'This segment does not match.'),
    ]
    const regionsSoFar = getRegionsByMatchStatus(
      [
        matchedSubsegments([0, 1], [0, 1]),
        unmatchedSubsegment(1),
        unmatchedSubsegment(2),
        matchedSubsegments([3, 4], [3, 4]),
      ],
      ttsSegments.length,
    )

    const minMatchLength = 11
    const levenshteinThreshold = 0

    const result = continueFindingMatches({
      baseTextSubsegments,
      ttsSegments,
      regionsSoFar,
      minMatchLength,
      levenshteinThreshold,
      pass: 'test',
    })

    const expectedRegions = getRegionsByMatchStatus(
      [
        matchedSubsegments([0, 1], [0, 1]),
        matchedSubsegments([1, 2], [1, 2]),
        matchedSubsegments([2, 3], [2, 3]),
        matchedSubsegments([3, 4], [3, 4]),
      ],
      ttsSegments.length,
    )

    expect(result.regions).toHaveLength(1)
    expect(result.regions).toEqual(expectedRegions)
  })
})

const matchedRegion = (
  [baseStart, baseEnd]: [number, number],
  [ttsStart, ttsEnd]: [number, number],
  results: MatchedBaseTextSubsegments[],
): MatchStatusRegion => ({
  isMatching: true,
  subsegments: { start: baseStart, end: baseEnd },
  ttsSegments: { start: ttsStart, end: ttsEnd },
  results,
})
const unmatchedRegion = (
  [baseStart, baseEnd]: [number, number],
  [ttsStart, ttsEnd]: [number, number],
  results: UnmatchedBaseTextSubsegment[],
): MatchStatusRegion => ({
  isMatching: false,
  subsegments: { start: baseStart, end: baseEnd },
  ttsSegments: { start: ttsStart, end: ttsEnd },
  results,
})

const unmatchedSubsegment = (index: number): UnmatchedBaseTextSubsegment => ({
  baseTextSubsegmentIndex: index,
  ttsSegmentIndex: null,
})
const matchedSubsegments = (
  [baseStart, baseEnd]: [number, number],
  [ttsStart, ttsEnd]: [number, number],
): MatchedBaseTextSubsegments => ({
  subsegments: {
    start: baseStart,
    end: baseEnd,
  },
  ttsSegments: {
    start: ttsStart,
    end: ttsEnd,
  },
  matchParameters: {
    pass: 'test',
    minMatchLength: expect.any(Number),
    levenshteinThreshold: expect.any(Number),
  },
})

const subsegment = (index: number, text: string) => ({
  segmentIndex: 0,
  indexInSource: index,
  subsegmentIndex: index,
  text,
  normalizedText: text.toLowerCase().replaceAll(/[\s.,!?;:()]/g, ''),
})
const ttsSegment = (index: number, text: string) => ({
  index,
  text,
  normalizedText: text.toLowerCase().replaceAll(/[\s.,!?;:()]/g, ''),
})
