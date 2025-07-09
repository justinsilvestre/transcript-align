import * as levenshtein from 'fast-levenshtein'
import { MatchStatusRegion } from './getRegionsByMatchStatus'
import {
  BaseTextSubsegment,
  TextToSpeechSegment,
  BaseTextSubsegmentsMatchResult,
  MatchedBaseTextSubsegments,
  UnmatchedBaseTextSubsegment,
} from './syncTranscriptWithSubtitles'

export function pickUpStragglers({
  regions,
  baseTextSubsegments,
  ttsSegments,
  log = false,
}: {
  regions: MatchStatusRegion[]
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  log?: boolean
}): BaseTextSubsegmentsMatchResult[] {
  const results: BaseTextSubsegmentsMatchResult[] = []

  // const downwardMovedUnmatchedRegions = new Set<number>()
  // const upwardMovedMatchedRegions = new Set<number>()
  let firstResultOverrideForNextMatchRegion: MatchedBaseTextSubsegments | null = null
  const getFirstResultOverride = () => {
    const result = firstResultOverrideForNextMatchRegion
    firstResultOverrideForNextMatchRegion = null
    return result
  }
  let removeFirstResultFromNextNonmatchRegion = false

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]

    if (region.isMatching) {
      const prevUnmatchedRegion = i > 0 ? regions[i - 1] : null
      if (prevUnmatchedRegion && prevUnmatchedRegion.isMatching) throw new Error('Malformed regions')
      let regionResults = region.results
      const resultsWithStragglerFromPreviousRegion = prevUnmatchedRegion
        ? bringInStragglerFromPreviousRegion(regionResults, prevUnmatchedRegion, baseTextSubsegments, ttsSegments)
        : null
      if (resultsWithStragglerFromPreviousRegion) {
        regionResults = resultsWithStragglerFromPreviousRegion
        results.pop()
      }

      const nextUnmatchedRegion = i < regions.length - 1 ? regions[i + 1] : null
      if (nextUnmatchedRegion && nextUnmatchedRegion.isMatching) throw new Error('Malformed regions')

      const resultsWithStragglerFromNextRegion = nextUnmatchedRegion
        ? bringInStragglerFromNextRegion(regionResults, nextUnmatchedRegion, baseTextSubsegments, ttsSegments)
        : null
      if (resultsWithStragglerFromNextRegion) {
        regionResults = resultsWithStragglerFromNextRegion
        removeFirstResultFromNextNonmatchRegion = true
      }

      results.push(...regionResults)
      if (log) {
        console.log('region', i, region)
        console.log('resultsWithStragglerFromPreviousRegion', resultsWithStragglerFromPreviousRegion)
        console.log('resultsWithStragglerFromNextRegion', resultsWithStragglerFromNextRegion)
        console.log('\n')
        console.log('')
        debugger
      }
    } else {
      if (removeFirstResultFromNextNonmatchRegion) {
        results.push(...region.results.slice(1)) // remove the first result from the next non-matching region
        removeFirstResultFromNextNonmatchRegion = false
      } else results.push(...region.results)
    }
  }
  return results
}

export function bringInStragglerFromNextRegion(
  regionResults: MatchedBaseTextSubsegments[],
  stragglerSourceRegion: MatchStatusRegion & { isMatching: false },
  baseTextSubsegments: BaseTextSubsegment[],
  ttsSegments: TextToSpeechSegment[],
  log = false,
) {
  const matchRegionLastSegment = regionResults[regionResults.length - 1]
  if (!matchRegionLastSegment) return null

  const matchRegionLastSubsegmentText = getNormalizedText(baseTextSubsegments, matchRegionLastSegment.subsegments)
  const matchRegionLastTtsSegmentText = getNormalizedText(ttsSegments, matchRegionLastSegment.ttsSegments)

  if (log) {
    console.log('matchRegionLastSegment', matchRegionLastSegment)
    // console.log('matchRegionLastSubsegmentText', matchRegionLastSubsegmentText)
    console.log('matchRegionLastTtsSegmentText', matchRegionLastTtsSegmentText)
  }

  // find the current region's first segment
  const potentialStragglerSegment = stragglerSourceRegion.results[0]
  if (!potentialStragglerSegment) return null

  const potentialStragglerBaseTextSubsegment = baseTextSubsegments[potentialStragglerSegment.baseTextSubsegmentIndex]
  const potentialStragglerTtsSegment: TextToSpeechSegment | null =
    ttsSegments[stragglerSourceRegion.ttsSegments.start] || null

  // first, both sides
  const isDoubleSideImprovement =
    Boolean(potentialStragglerTtsSegment) &&
    doesChangeImproveLevenshteinDistance(
      matchRegionLastSubsegmentText,
      matchRegionLastTtsSegmentText,
      matchRegionLastSubsegmentText + potentialStragglerBaseTextSubsegment.normalizedText,
      matchRegionLastTtsSegmentText + potentialStragglerTtsSegment.normalizedText,
      log,
    )
  if (log)
    console.log(
      'double side improvement?',
      {
        isDoubleSideImprovement,
        potentialStragglerTtsSegment,
      },
      [
        matchRegionLastSubsegmentText,
        matchRegionLastTtsSegmentText,
        matchRegionLastSubsegmentText + potentialStragglerBaseTextSubsegment.normalizedText,
        matchRegionLastTtsSegmentText + potentialStragglerTtsSegment?.normalizedText,
      ],
    )
  if (isDoubleSideImprovement)
    return [
      ...regionResults.slice(0, -1),
      {
        ...matchRegionLastSegment,
        subsegments: {
          ...matchRegionLastSegment.subsegments,
          end: matchRegionLastSegment.subsegments.end + 1,
        },
        ttsSegments: {
          ...matchRegionLastSegment.ttsSegments,
          end: matchRegionLastSegment.ttsSegments.end + 1,
        },
      },
    ]

  // next, just the base text
  const isBaseTextImprovement = doesChangeImproveLevenshteinDistance(
    matchRegionLastSubsegmentText,
    matchRegionLastTtsSegmentText,
    matchRegionLastSubsegmentText + potentialStragglerBaseTextSubsegment.normalizedText,
    matchRegionLastTtsSegmentText,
  )
  if (log)
    console.log(
      'base text improvement?',
      {
        isBaseTextImprovement,
      },
      [
        matchRegionLastSubsegmentText,
        matchRegionLastTtsSegmentText,
        matchRegionLastSubsegmentText + potentialStragglerBaseTextSubsegment.normalizedText,
        matchRegionLastTtsSegmentText,
      ],
    )

  if (isBaseTextImprovement) {
    return [
      ...regionResults.slice(0, -1),
      {
        ...matchRegionLastSegment,
        subsegments: {
          ...matchRegionLastSegment.subsegments,
          end: matchRegionLastSegment.subsegments.end + 1,
        },
      },
    ]
  }

  return null
}

function bringInStragglerFromPreviousRegion(
  regionResults: MatchedBaseTextSubsegments[],
  stragglerSourceRegion: MatchStatusRegion & { isMatching: false },
  baseTextSubsegments: BaseTextSubsegment[],
  ttsSegments: TextToSpeechSegment[],
  log = false,
) {
  const matchRegionSegments = regionResults

  const matchRegionFirstSegment = matchRegionSegments[0]
  if (!matchRegionFirstSegment) return null

  const matchRegionFirstSubsegmentText = getNormalizedText(baseTextSubsegments, matchRegionFirstSegment.subsegments)
  const matchRegionFirstTtsSegmentText = getNormalizedText(ttsSegments, matchRegionFirstSegment.ttsSegments)

  if (log) {
    console.log('matchRegionFirstSegment', matchRegionFirstSegment)
    console.log('matchRegionFirstTtsSegmentText', matchRegionFirstTtsSegmentText)
  }

  // find the previous region's last segment
  const potentialStragglerSegment = stragglerSourceRegion.results[stragglerSourceRegion.results.length - 1]
  if (!potentialStragglerSegment) return null

  const potentialStragglerBaseTextSubsegment = baseTextSubsegments[potentialStragglerSegment.baseTextSubsegmentIndex]
  const potentialStragglerTtsSegment: TextToSpeechSegment | null =
    ttsSegments[stragglerSourceRegion.ttsSegments.end - 1] || null

  // both sides
  const isDoubleSideImprovement =
    Boolean(potentialStragglerTtsSegment) &&
    doesChangeImproveLevenshteinDistance(
      matchRegionFirstSubsegmentText,
      matchRegionFirstTtsSegmentText,
      potentialStragglerBaseTextSubsegment.normalizedText + matchRegionFirstSubsegmentText,
      potentialStragglerTtsSegment.normalizedText + matchRegionFirstTtsSegmentText,
      log,
    )
  if (log)
    console.log(
      'double side improvement?',
      {
        isDoubleSideImprovement,
        potentialStragglerTtsSegment,
      },
      [
        matchRegionFirstSubsegmentText,
        matchRegionFirstTtsSegmentText,
        potentialStragglerBaseTextSubsegment.normalizedText + matchRegionFirstSubsegmentText,
        potentialStragglerTtsSegment?.normalizedText + matchRegionFirstTtsSegmentText,
      ],
    )
  if (isDoubleSideImprovement)
    return [
      {
        ...matchRegionFirstSegment,
        subsegments: {
          ...matchRegionFirstSegment.subsegments,
          start: matchRegionFirstSegment.subsegments.start - 1,
        },
        ttsSegments: {
          ...matchRegionFirstSegment.ttsSegments,
          start: matchRegionFirstSegment.ttsSegments.start - 1,
        },
      },
      ...matchRegionSegments.slice(1),
    ]

  // just the base text
  const isBaseTextImprovement = doesChangeImproveLevenshteinDistance(
    matchRegionFirstSubsegmentText,
    matchRegionFirstTtsSegmentText,
    potentialStragglerBaseTextSubsegment.normalizedText + matchRegionFirstSubsegmentText,
    matchRegionFirstTtsSegmentText,
  )
  if (log)
    console.log(
      'base text improvement?',
      {
        isBaseTextImprovement,
      },
      [
        matchRegionFirstSubsegmentText,
        matchRegionFirstTtsSegmentText,
        potentialStragglerBaseTextSubsegment.normalizedText + matchRegionFirstSubsegmentText,
        matchRegionFirstTtsSegmentText,
      ],
    )

  if (isBaseTextImprovement) {
    return [
      {
        ...matchRegionFirstSegment,
        subsegments: {
          ...matchRegionFirstSegment.subsegments,
          start: matchRegionFirstSegment.subsegments.start - 1,
        },
      },
      ...matchRegionSegments.slice(1),
    ]
  }

  if (potentialStragglerTtsSegment) {
    const isTtsImprovement = doesChangeImproveLevenshteinDistance(
      matchRegionFirstTtsSegmentText,
      matchRegionFirstSubsegmentText,
      potentialStragglerTtsSegment.normalizedText + matchRegionFirstTtsSegmentText,
      matchRegionFirstSubsegmentText,
      log,
    )
    if (log)
      console.log(
        'tts improvement?',
        {
          isTtsImprovement,
          potentialStragglerTtsSegment,
        },
        [
          matchRegionFirstTtsSegmentText,
          matchRegionFirstSubsegmentText,
          potentialStragglerTtsSegment.normalizedText + matchRegionFirstTtsSegmentText,
          matchRegionFirstSubsegmentText,
        ],
      )
  }

  return null
}

function doesChangeImproveLevenshteinDistance(
  before: string,
  beforeComparisonBase: string,
  after: string,
  afterComparisonBase: string,
  log: boolean = false,
) {
  const beforeDistance = levenshtein.get(beforeComparisonBase, before)
  const afterDistance = levenshtein.get(afterComparisonBase, after)

  if (log) {
    console.log('levenshtein distance', {
      before,
      after,
      afterComparisonBase,
      beforeDistance,
      afterDistance,
    })
  }

  return afterDistance < beforeDistance
}

export function getNormalizedText<T extends { normalizedText: string }>(
  array: T[],
  { start, end }: { start: number; end: number },
): string {
  return array
    .slice(start, end)
    .map((element) => element.normalizedText)
    .join('')
}

function getElementsInRange<T>(array: T[], { start, end }: { start: number; end: number }): T[] {
  return array.slice(start, end)
}
