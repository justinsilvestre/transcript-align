import {
  BaseTextSubsegmentsMatchResult,
  MatchedBaseTextSubsegments,
  UnmatchedBaseTextSubsegment,
} from './syncTranscriptWithSubtitles'

export function getRegionsByMatchStatus(results: BaseTextSubsegmentsMatchResult[], ttsSegmentsCount: number) {
  const regions: MatchStatusRegion[] = []

  for (let i = 0; i < results.length; i++) {
    const previousResult = results[i - 1]
    const currentResult = results[i]
    if (!previousResult) {
      regions.push(
        isMatch(currentResult)
          ? {
              subsegments: {
                start: currentResult.subsegments.start,
                end: currentResult.subsegments.end,
              },
              ttsSegments: { start: currentResult.ttsSegments.start, end: currentResult.ttsSegments.end },
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
        currentRegion.subsegments.end = currentResult.subsegments.end
        currentRegion.ttsSegments.end = currentResult.ttsSegments.end
        currentRegion.results.push(currentResult)
      } else {
        regions.push({
          subsegments: {
            start: currentResult.subsegments.start,
            end: currentResult.subsegments.end,
          },
          ttsSegments: { start: currentResult.ttsSegments.start, end: currentResult.ttsSegments.end },
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
/** Uses BaseTextSubsegment absolute indexes */
export type MatchStatusRegion =
  | {
      subsegments: { start: number; end: number }
      ttsSegments: { start: number; end: number }
      isMatching: true
      results: MatchedBaseTextSubsegments[]
    }
  | {
      subsegments: { start: number; end: number }
      ttsSegments: { start: number; end: number }
      isMatching: false
      results: UnmatchedBaseTextSubsegment[]
    }

export function isMatch(result: BaseTextSubsegmentsMatchResult): result is MatchedBaseTextSubsegments {
  return 'subsegments' in result
}
