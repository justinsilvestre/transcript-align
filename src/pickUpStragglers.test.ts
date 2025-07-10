import * as levenshtein from 'fast-levenshtein'
import { describe, it, expect } from 'vitest'
import { MatchStatusRegion } from './getRegionsByMatchStatus'
import {
  BaseTextSubsegment,
  BaseTextSubsegmentsMatchResult,
  MatchedBaseTextSubsegments,
  TextToSpeechSegment,
  UnmatchedBaseTextSubsegment,
} from './syncTranscriptWithSubtitles'
import { bringInStragglerFromNextRegion, pickUpStragglers } from './pickUpStragglers'
import { defaultNormalizeJapanese } from './defaultNormalizeJapanese'

describe('pickUpStragglers', () => {
  it('should pick up one-side stragglers correctly', () => {
    // regions:
    // X 'The'
    // O 'quick brown fox' 'jumps over' --- 'the quick brown fox' 'jumps over'
    // X 'the lazy dog.' --- 'the lazy dog.'
    // O 'The rain in Spain' --- 'the rain in spain'
    // X 'falls'
    // O 'mainly on the plain.' --- 'mainly on the plain'
    const baseTextSubsegments: BaseTextSubsegment[] = [
      { segmentIndex: 0, indexInSource: 0, subsegmentIndex: 0, text: 'The', normalizedText: 'the' },
      {
        segmentIndex: 0,
        indexInSource: 1,
        subsegmentIndex: 1,
        text: 'quick brown fox',
        normalizedText: 'quick brown fox',
      },
      { segmentIndex: 0, indexInSource: 2, subsegmentIndex: 2, text: 'jumps over', normalizedText: 'jumps over' },
      { segmentIndex: 0, indexInSource: 3, subsegmentIndex: 3, text: 'the lazy dog.', normalizedText: 'the lazy dog' },
      {
        segmentIndex: 0,
        indexInSource: 4,
        subsegmentIndex: 4,
        text: 'The rain in Spain',
        normalizedText: 'the rain in spain',
      },
      { segmentIndex: 0, indexInSource: 5, subsegmentIndex: 5, text: 'falls', normalizedText: 'falls' },
      {
        segmentIndex: 0,
        indexInSource: 6,
        subsegmentIndex: 6,
        text: 'mainly on the plain.',
        normalizedText: 'mainly on the plain',
      },
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      { index: 0, text: 'the quick brown fox', normalizedText: 'the quick brown fox' },
      { index: 1, text: 'jumps over', normalizedText: 'jumps over' },
      { index: 2, text: 'the lazy dog', normalizedText: 'the lazy dog' },
      { index: 3, text: 'the rain in spain', normalizedText: 'the rain in spain' },
      { index: 4, text: 'falls mainly on the plain', normalizedText: 'falls mainly on the plain' },
    ]
    const unmatched = (index: number): UnmatchedBaseTextSubsegment => ({
      baseTextSubsegmentIndex: index,
      ttsSegmentIndex: null,
    })
    const matched = (
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
        pass: 'straggler',
        minMatchLength: expect.any(Number),
        levenshteinThreshold: expect.any(Number),
      },
    })

    const regions: MatchStatusRegion[] = [
      {
        isMatching: false,
        subsegments: {
          start: 0,
          end: 1,
        },
        ttsSegments: {
          start: -1,
          end: -1,
        },
        results: [unmatched(0)], // 'The'
      },
      {
        isMatching: true,
        subsegments: {
          start: 1,
          end: 3,
        },
        ttsSegments: {
          start: 0,
          end: 2,
        },
        results: [
          matched([1, 2], [0, 1]), // 'quick brown fox' --- 'quick brown fox'
          matched([2, 3], [1, 2]), // 'jumps over' --- 'jumps over'
        ],
      },
      {
        isMatching: false,
        subsegments: {
          start: 3,
          end: 4,
        },
        ttsSegments: {
          start: 3,
          end: 3,
        },
        results: [unmatched(3)], // 'the lazy dog.'
      },
      {
        isMatching: true,
        subsegments: {
          start: 4,
          end: 5,
        },
        ttsSegments: {
          start: 3,
          end: 4,
        },
        results: [matched([4, 5], [3, 4])], // 'The rain in Spain' --- 'the rain in spain'
      },
      {
        isMatching: false,
        subsegments: {
          start: 5,
          end: 6,
        },
        ttsSegments: {
          start: 4,
          end: 4,
        },
        results: [unmatched(5)], // 'falls'
      },
      {
        isMatching: true,
        subsegments: {
          start: 6,
          end: 7,
        },
        ttsSegments: {
          start: 4,
          end: 5,
        },
        results: [matched([6, 7], [4, 5])], // 'mainly on the plain.' --- 'falls mainly on the plain'
      },
    ]

    const result = pickUpStragglers({
      regions,
      baseTextSubsegments,
      ttsSegments,
    })
    expect(result).toEqual([
      matched([0, 2], [0, 1]), // 'The' + 'quick brown fox' --- 'the quick brown fox'
      matched([2, 3], [1, 2]), // 'jumps over' --- 'jumps over'
      unmatched(3), // 'the lazy dog.'
      matched([4, 5], [3, 4]), // 'The rain in Spain' --- 'the rain in spain'
      matched([5, 7], [4, 5]), // 'falls' + 'mainly on the plain.' --- 'falls mainly on the plain'
    ])
  })

  it('should pick up two-side stragglers correctly', () => {
    // regions:
    // O 'Two roads diverge in' --- 'two roads'
    // X 'a yellow wood' --- 'diverge in a yellow wood'
    const baseTextSubsegments: BaseTextSubsegment[] = [
      {
        segmentIndex: 0,
        indexInSource: 0,
        subsegmentIndex: 0,
        text: 'Two roads diverge in',
        normalizedText: 'two roads diverge in',
      },
      { segmentIndex: 0, indexInSource: 1, subsegmentIndex: 1, text: 'a yellow wood', normalizedText: 'a yellow wood' },
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      { index: 0, text: 'two roads', normalizedText: 'two roads' },
      { index: 1, text: 'diverge in a yellow wood', normalizedText: 'diverge in a yellow wood' },
    ]

    const regions: MatchStatusRegion[] = [
      matchedRegion(
        [0, 1],
        [0, 1],
        [
          matched([0, 1], [0, 1]), // 'Two roads diverge in' --- 'two roads'
        ],
      ),
      unmatchedRegion(
        [1, 2],
        [1, 2],
        [
          unmatched(1), // 'a yellow wood'
        ],
      ),
    ]

    const result = pickUpStragglers({
      regions,
      baseTextSubsegments,
      ttsSegments,
    })
    expect(result).toEqual([
      matched([0, 2], [0, 2]), // 'Two roads diverge in' + 'a yellow wood' --- 'two roads' + 'diverge in a yellow wood'
    ])
  })

  it('should get a simple one-sided straggler', () => {
    // regions:
    // O 'Hello world!' --- 'hello world'
    // X 'The'
    // O 'Cat in the Hat' --- 'the cat in the hat'
    const baseTextSubsegments: BaseTextSubsegment[] = [
      { segmentIndex: 0, indexInSource: 0, subsegmentIndex: 0, text: 'Hello world!', normalizedText: 'hello world' },
      { segmentIndex: 0, indexInSource: 1, subsegmentIndex: 1, text: 'The', normalizedText: 'the' },
      {
        segmentIndex: 0,
        indexInSource: 2,
        subsegmentIndex: 2,
        text: 'Cat in the Hat',
        normalizedText: 'cat in the hat',
      },
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      { index: 0, text: 'hello world', normalizedText: 'hello world' },
      { index: 1, text: 'the cat in the hat', normalizedText: 'the cat in the hat' },
    ]

    const regions: MatchStatusRegion[] = [
      matchedRegion(
        [0, 1],
        [0, 1],
        [
          matched([0, 1], [0, 1]), // 'Hello world!' --- 'hello world'
        ],
      ),
      unmatchedRegion(
        [1, 2],
        [1, 1],
        [
          unmatched(1), // 'The'
        ],
      ),
      matchedRegion(
        [2, 3],
        [1, 2],
        [
          matched([2, 3], [1, 2]), // 'Cat in the Hat' --- 'the cat in the hat'
        ],
      ),
    ]

    const result = pickUpStragglers({
      regions,
      baseTextSubsegments,
      ttsSegments,
      log: true,
    })
    expect(result).toEqual([
      matched([0, 1], [0, 1]), // 'Hello world!' --- 'hello world'
      matched([1, 3], [1, 2]), // 'The' + 'Cat in the Hat' --- 'the cat in the hat'
    ])
  })

  it('leaves neighbor alone when the improvement is not substantial', () => {
    // regions:
    // O result 1: '意識の外に追い出されていた。 ' --- '意識の外に追い出されていた'
    //   result 2: '「きっと、' + 'そうか。」' --- 'きっとそうか'
    // X '老婆の話が完ると、'                 'ローマの話が終わると'
    //   '下人は嘲るような声で念を押した。'     '手には着けるような声で 念を押した'
    // O result 1: 'そうして、' + '一足前へ出ると、' --- 'そして一歩前へ出ると不意に右の手を'

    const baseTextSubsegments: BaseTextSubsegment[] = [
      subsegment(0, '意識の外に追い出されていた。'),
      subsegment(1, '「きっと、'),
      subsegment(2, 'そうか。」'),
      subsegment(3, '老婆の話が完ると、'),
      subsegment(4, '下人は嘲るような声で念を押した。'),
      subsegment(5, 'そうして、'),
      subsegment(6, '一足前へ出ると、'),
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      ttsSegment(0, '意識の外に追い出されていた'),
      ttsSegment(1, 'きっとそうか'),
      ttsSegment(2, 'ローマの話が終わると'),
      ttsSegment(3, '手には着けるような声で 念を押した'),
      ttsSegment(4, 'そして一歩前へ出ると不意に右の手を'),
    ]
    // prettier-ignore
    const regions: MatchStatusRegion[] = [
      { isMatching: true, subsegments: { start: 0, end: 3 }, ttsSegments: { start: 0, end: 2 }, results: [
        matched([0, 1], [0, 1]), // '意識の外に追い出されていた。' --- '意識の外に追い出されていた'
        matched([1, 3], [1, 2]), // '「きっと、' + 'そうか。」' --- 'きっとそうか'
      ]},
      { isMatching: false, subsegments: { start: 3, end: 5 }, ttsSegments: { start: 2, end: 4 }, results: [
        unmatched(3), // '老婆の話が完ると、'                 'ローマの話が終わると'
        unmatched(4), // '下人は嘲るような声で念を押した。'     '手には着けるような声で 念を押した'
      ]},
      { isMatching: true, subsegments: { start: 5, end: 7 }, ttsSegments: { start: 4, end: 5 }, results: [
        matched([5, 7], [4, 5]) // 'そうして、' + '一足前へ出ると、' --- 'そして一歩前へ出ると不意に右の手を'
      ]}
    ]

    const result = pickUpStragglers({
      baseTextSubsegments,
      ttsSegments,
      regions,
    })

    const originalResults: BaseTextSubsegmentsMatchResult[] = regions.flatMap((region) => {
      const results: BaseTextSubsegmentsMatchResult[] = region.results
      return results
    })

    expect(result).toEqual(originalResults)
  })
})

describe('bringInStragglerFromNextRegion', () => {
  it("doesn't bring in anything when no straggler is available", () => {
    const baseTextSubsegments: BaseTextSubsegment[] = [
      {
        segmentIndex: 0,
        indexInSource: 0,
        subsegmentIndex: 0,
        text: 'The Cat in the hat',
        normalizedText: 'the cat in the hat',
      },
      { segmentIndex: 0, indexInSource: 1, subsegmentIndex: 1, text: 'Hello world', normalizedText: 'hello world' },
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      { index: 0, text: 'the cat in the hat', normalizedText: 'the cat in the hat' },
      { index: 1, text: 'hello world', normalizedText: 'hello world' },
    ]

    const matchedRegion: MatchStatusRegion = {
      isMatching: true,
      subsegments: { start: 0, end: 1 },
      ttsSegments: { start: 0, end: 1 },
      results: [matched([0, 1], [0, 1])],
    }

    const nextUnmatchedRegion: MatchStatusRegion = {
      isMatching: false,
      subsegments: { start: 1, end: 2 },
      ttsSegments: { start: 1, end: 2 },
      results: [unmatched(1)],
    }

    const matchRegionResultsWithPickedUpStraggler = bringInStragglerFromNextRegion(
      matchedRegion.results,
      nextUnmatchedRegion,
      baseTextSubsegments,
      ttsSegments,
    )
    expect(matchRegionResultsWithPickedUpStraggler).toEqual(null)
  })

  it('brings in one-side straggler from next region', () => {
    // regions:
    // O 'The Cat in the' --- 'the cat in the hat'
    // X 'Hat'

    // initial levenshtein comparison is between O's 'The Cat in the' and 'the cat in the hat'
    // next levenshtein comparison is between 'The Cat in the' + 'Hat' and 'the cat in the hat'
    const baseTextSubsegments: BaseTextSubsegment[] = [
      {
        segmentIndex: 0,
        indexInSource: 0,
        subsegmentIndex: 0,
        text: 'The Cat in the',
        normalizedText: 'the cat in the',
      },
      { segmentIndex: 0, indexInSource: 1, subsegmentIndex: 1, text: 'Hat', normalizedText: 'hat' },
    ]
    const ttsSegments: TextToSpeechSegment[] = [
      { index: 0, text: 'the cat in the hat', normalizedText: 'the cat in the hat' },
    ]

    const matchedRegion: MatchStatusRegion = {
      isMatching: true,
      subsegments: { start: 0, end: 1 },
      ttsSegments: { start: 0, end: 1 },
      results: [matched([0, 1], [0, 1])],
    }
    const nextUnmatchedRegion: MatchStatusRegion = {
      isMatching: false,
      subsegments: { start: 1, end: 2 },
      ttsSegments: { start: 1, end: 1 },
      results: [unmatched(1)],
    }

    const matchRegionResultsWithPickedUpStraggler = bringInStragglerFromNextRegion(
      matchedRegion.results,
      nextUnmatchedRegion,
      baseTextSubsegments,
      ttsSegments,
      true, // log
    )

    expect(matchRegionResultsWithPickedUpStraggler).toEqual([matched([0, 2], [0, 1])])
  })
})

const subsegment = (index: number, text: string) => ({
  segmentIndex: 0,
  indexInSource: index,
  subsegmentIndex: index,
  text,
  normalizedText: defaultNormalizeJapanese(text),
})
const ttsSegment = (index: number, text: string) => ({
  index,
  text,
  normalizedText: defaultNormalizeJapanese(text),
})

const unmatched = (index: number): UnmatchedBaseTextSubsegment => ({
  baseTextSubsegmentIndex: index,
  ttsSegmentIndex: null,
})
const matched = (
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
    pass: 'straggler',
    minMatchLength: expect.any(Number),
    levenshteinThreshold: expect.any(Number),
  },
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
