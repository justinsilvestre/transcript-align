import * as levenshtein from 'fast-levenshtein'
import { MatchStatusRegion } from './getRegionsByMatchStatus'
import {
  BaseTextSubsegment,
  TextToSpeechSegment,
  BaseTextSubsegmentsMatchResult,
  MatchedBaseTextSubsegments,
  UnmatchedBaseTextSubsegment,
} from './syncTranscriptWithSubtitles'
import { isLevenshteinImprovement } from './isLevenshteinImprovement'

function getElementsInRange<T>(arr: T[], { start, end }: { start: number; end: number }): T[] {
  return arr.slice(start, end)
}

export function alignSegmentCombinationsWithinRegions(options: {
  regions: MatchStatusRegion[]
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  similarityThreshold?: number
}) {
  const { regions, baseTextSubsegments, ttsSegments, similarityThreshold } = options
  const newResults: BaseTextSubsegmentsMatchResult[] = []

  for (const region of regions) {
    if (region.isMatching) {
      newResults.push(...region.results)
      continue
    }

    if (region.results.length === 1 && region.ttsSegments.end - region.ttsSegments.start === 1) {
      newResults.push(...region.results)
      continue
    }

    if (region.ttsSegments.end - region.ttsSegments.start < 1) {
      newResults.push(...region.results)
      continue
    }

    // now the previous region is a matching one,
    // and this region is an unmatched one,
    // and we are sure to have both base text subsegment(s) and tts segment(s) in this region.

    const crawlDownRange = {
      subsegments: {
        start: region.subsegments.start,
        // end: region.subsegments.start + Math.ceil((region.subsegments.end - region.subsegments.start) / 2),
        end: region.subsegments.end,
      },
      ttsSegments: {
        start: region.ttsSegments.start,
        // end: region.ttsSegments.start + Math.ceil((region.ttsSegments.end - region.ttsSegments.start) / 2),
        end: region.ttsSegments.end,
      },
    }

    let topImprovement =
      findFirstImprovementFromTop({
        baseTextSubsegments,
        ttsSegments,
        region,
        crawlRange: crawlDownRange,
      }) || null
    while (topImprovement) {
      const expansion = expandImprovementDown({
        baseTextSubsegments,
        ttsSegments,
        region,
        improvement: topImprovement,
        crawlRange: crawlDownRange,
      })
      if (!expansion) break

      topImprovement = expansion
    }
    if (!passesSimilarityThreshold(topImprovement, similarityThreshold)) topImprovement = null

    const crawlUpRange = {
      subsegments: {
        // start: topImprovement ? topImprovement.subsegments.end : crawlDownRange.subsegments.end,
        // start: topImprovement
        //   ? topImprovement.subsegments.end
        //   : region.subsegments.start + Math.floor((region.subsegments.end - region.subsegments.start) / 2),
        start: topImprovement ? topImprovement.subsegments.end : region.subsegments.start,
        end: region.subsegments.end,
      },
      ttsSegments: {
        // start: topImprovement ? topImprovement.ttsSegments.end : crawlDownRange.ttsSegments.end,
        // start: topImprovement
        //   ? topImprovement.ttsSegments.end
        //   : region.ttsSegments.start + Math.floor((region.ttsSegments.end - region.ttsSegments.start) / 2),
        start: topImprovement ? topImprovement.ttsSegments.end : region.ttsSegments.start,
        end: region.ttsSegments.end,
      },
    }
    let bottomImprovement =
      findFirstImprovementFromBottom({
        baseTextSubsegments,
        ttsSegments,
        region,
        crawlRange: crawlUpRange,
      }) || null
    while (bottomImprovement) {
      const expansion = expandImprovementUp({
        baseTextSubsegments,
        ttsSegments,
        improvement: bottomImprovement,
        crawlRange: crawlUpRange,
      })
      if (!expansion) break

      bottomImprovement = expansion
    }
    if (!passesSimilarityThreshold(topImprovement, similarityThreshold)) topImprovement = null

    if (!topImprovement && !bottomImprovement) {
      // if no pairing was found, keep the original results.
      newResults.push(...region.results)
      // continue
    } else {
      if (topImprovement) {
        const newTopMatch: MatchedBaseTextSubsegments = {
          subsegments: {
            start: topImprovement.subsegments.start,
            end: topImprovement.subsegments.end,
          },
          ttsSegments: {
            start: topImprovement.ttsSegments.start,
            end: topImprovement.ttsSegments.end,
          },
          matchParameters: {
            pass: 'topImprovement',
            minMatchLength: 40, // placeholder
            levenshteinThreshold: 5, //placeholder
          },
        }
        const newUnmatchedBefore: UnmatchedBaseTextSubsegment[] = getElementsInRange(baseTextSubsegments, {
          start: region.subsegments.start,
          end: newTopMatch.subsegments.start,
        }).map((subsegment, index) => ({
          baseTextSubsegmentIndex: subsegment.subsegmentIndex,
          ttsSegmentIndex: null,
        }))

        newResults.push(...newUnmatchedBefore, newTopMatch)
      }
      const newUnmatchedMiddle: UnmatchedBaseTextSubsegment[] = getElementsInRange(baseTextSubsegments, {
        // start: newTopMatch.subsegments.end,
        start: topImprovement ? topImprovement.subsegments.end : region.subsegments.start,
        end: bottomImprovement ? bottomImprovement.subsegments.start : region.subsegments.end,
      }).map((subsegment, index) => ({
        baseTextSubsegmentIndex: subsegment.subsegmentIndex,
        ttsSegmentIndex: null,
      }))
      newResults.push(...newUnmatchedMiddle)

      if (bottomImprovement) {
        const newBottomMatch: MatchedBaseTextSubsegments = {
          subsegments: {
            start: bottomImprovement.subsegments.start,
            end: bottomImprovement.subsegments.end,
          },
          ttsSegments: {
            start: bottomImprovement.ttsSegments.start,
            end: bottomImprovement.ttsSegments.end,
          },
          matchParameters: {
            pass: 'bottomImprovement', // this is the first pass of the alignment
            minMatchLength: 40, // placeholder
            levenshteinThreshold: 5, //placeholder
          },
        }

        const newUnmatchedAfter: UnmatchedBaseTextSubsegment[] = getElementsInRange(baseTextSubsegments, {
          start: newBottomMatch.subsegments.end,
          end: region.subsegments.end,
        }).map((subsegment, index) => ({
          baseTextSubsegmentIndex: subsegment.subsegmentIndex,
          ttsSegmentIndex: null,
        }))
        newResults.push(newBottomMatch, ...newUnmatchedAfter)
      }
    }
  }

  return newResults
}

type Pairing = {
  subsegments: {
    start: number
    end: number
    normalizedText: string
  }
  ttsSegments: {
    start: number
    end: number
    normalizedText: string
  }
}

function crawlDownAndCheckForImprovement(
  subsegments: BaseTextSubsegment[],
  ttsSegments: TextToSpeechSegment[],
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  },
  currentPairing: {
    subsegments: { start: number; end: number; normalizedText: string }
    ttsSegments: { start: number; end: number; normalizedText: string }
  },
  side: 'subsegments' | 'ttsSegments',
) {
  const nextIndex = currentPairing[side].end
  if (nextIndex >= crawlRange[side].end) {
    return null
  }

  const crawlStartText = currentPairing[side].normalizedText
  const nextText = (side === 'subsegments' ? subsegments : ttsSegments)[nextIndex].normalizedText
  const targetText = currentPairing[side === 'subsegments' ? 'ttsSegments' : 'subsegments'].normalizedText

  const crawled = {
    ...currentPairing,
    [side]: {
      start: currentPairing[side].start,
      end: nextIndex + 1,
      normalizedText: crawlStartText + nextText,
    },
  }

  const isImproved = isLevenshteinImprovement(crawlStartText, nextText, targetText)

  if (!isImproved) return null

  return crawled
}
function crawlUpAndCheckForImprovement(
  subsegments: BaseTextSubsegment[],
  ttsSegments: TextToSpeechSegment[],
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  },
  currentPairing: {
    subsegments: { start: number; end: number; normalizedText: string }
    ttsSegments: { start: number; end: number; normalizedText: string }
  },
  side: 'subsegments' | 'ttsSegments',
) {
  const previousIndex = currentPairing[side].start - 1
  if (previousIndex < crawlRange[side].start) {
    return null
  }

  const crawlStartText = currentPairing[side].normalizedText
  const previousText = (side === 'subsegments' ? subsegments : ttsSegments)[previousIndex].normalizedText
  const targetText = currentPairing[side === 'subsegments' ? 'ttsSegments' : 'subsegments'].normalizedText

  const crawled = {
    ...currentPairing,
    [side]: {
      start: previousIndex,
      end: currentPairing[side].end,
      normalizedText: previousText + crawlStartText,
    },
  }

  const isImproved = isLevenshteinImprovement(previousText, crawlStartText, targetText)

  if (!isImproved) return null

  return crawled
}

function findFirstImprovementFromTop({
  baseTextSubsegments,
  ttsSegments,
  region,
  crawlRange,
}: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  region: MatchStatusRegion
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  }
}) {
  function getTopPairingWithOffsets(baseOffset: number, ttsOffset: number) {
    return {
      subsegments: {
        start: region.subsegments.start + baseOffset,
        end: region.subsegments.start + baseOffset + 1,
        normalizedText: baseTextSubsegments[region.subsegments.start + baseOffset]?.normalizedText,
      },
      ttsSegments: {
        start: region.ttsSegments.start + ttsOffset,
        end: region.ttsSegments.start + ttsOffset + 1,
        normalizedText: ttsSegments[region.ttsSegments.start + ttsOffset]?.normalizedText,
      },
    }
  }
  function increaseOffsets(baseOffset: number, ttsOffset: number) {
    if (baseOffset <= ttsOffset) {
      return { baseOffset: baseOffset + 1, ttsOffset }
    }
    return { baseOffset, ttsOffset: ttsOffset + 1 }
  }
  for (
    let offsets = { baseOffset: 0, ttsOffset: 0 };
    region.subsegments.start + offsets.baseOffset < region.subsegments.end &&
    region.ttsSegments.start + offsets.ttsOffset < region.ttsSegments.end;
    offsets = increaseOffsets(offsets.baseOffset, offsets.ttsOffset)
  ) {
    const topPairing = getTopPairingWithOffsets(offsets.baseOffset, offsets.ttsOffset)

    const crawlDownLeft = crawlDownAndCheckForImprovement(
      baseTextSubsegments,
      ttsSegments,
      crawlRange,
      topPairing,
      'subsegments',
    )
    if (crawlDownLeft) return crawlDownLeft
    const crawlDownRight = crawlDownAndCheckForImprovement(
      baseTextSubsegments,
      ttsSegments,
      crawlRange,
      topPairing,
      'ttsSegments',
    )
    if (crawlDownRight) return crawlDownRight
  }
}

function expandImprovementDown({
  baseTextSubsegments,
  ttsSegments,
  region,
  improvement,
  crawlRange,
}: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  region: MatchStatusRegion
  improvement: Pairing
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  }
}) {
  const currentPairing = {
    subsegments: {
      start: improvement.subsegments.start,
      end: improvement.subsegments.end,
      normalizedText: getElementsInRange(baseTextSubsegments, {
        start: improvement.subsegments.start,
        end: improvement.subsegments.end,
      })
        .map((s) => s.normalizedText)
        .join(''),
    },
    ttsSegments: {
      start: improvement.ttsSegments.start,
      end: improvement.ttsSegments.end,
      normalizedText: getElementsInRange(ttsSegments, {
        start: improvement.ttsSegments.start,
        end: improvement.ttsSegments.end,
      })
        .map((s) => s.normalizedText)
        .join(''),
    },
  }

  const crawlDownLeft = crawlDownAndCheckForImprovement(
    baseTextSubsegments,
    ttsSegments,
    crawlRange,
    currentPairing,
    'subsegments',
  )
  const crawlDownRight = crawlDownAndCheckForImprovement(
    baseTextSubsegments,
    ttsSegments,
    crawlRange,
    crawlDownLeft || currentPairing,
    'ttsSegments',
  )
  return crawlDownRight || crawlDownLeft || null
}

function findFirstImprovementFromBottom({
  baseTextSubsegments,
  ttsSegments,
  region,
  crawlRange,
}: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  region: MatchStatusRegion
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  }
}) {
  function getBottomPairingWithOffsets(baseOffset: number, ttsOffset: number) {
    return {
      subsegments: {
        start: region.subsegments.end - baseOffset - 1,
        end: region.subsegments.end - baseOffset,
        normalizedText: baseTextSubsegments[region.subsegments.end - baseOffset - 1].normalizedText,
      },
      ttsSegments: {
        start: region.ttsSegments.end - ttsOffset - 1,
        end: region.ttsSegments.end - ttsOffset,
        normalizedText: ttsSegments[region.ttsSegments.end - ttsOffset - 1].normalizedText,
      },
    }
  }
  function increaseOffsets(baseOffset: number, ttsOffset: number) {
    if (baseOffset <= ttsOffset) {
      return { baseOffset: baseOffset + 1, ttsOffset }
    }
    return { baseOffset, ttsOffset: ttsOffset + 1 }
  }
  for (
    let offsets = { baseOffset: 0, ttsOffset: 0 };
    region.subsegments.end - offsets.baseOffset - 1 >= region.subsegments.start &&
    region.ttsSegments.end - offsets.ttsOffset - 1 >= region.ttsSegments.start;
    offsets = increaseOffsets(offsets.baseOffset, offsets.ttsOffset)
  ) {
    const bottomPairing = getBottomPairingWithOffsets(offsets.baseOffset, offsets.ttsOffset)

    const crawlUpLeft = crawlUpAndCheckForImprovement(
      baseTextSubsegments,
      ttsSegments,
      crawlRange,
      bottomPairing,
      'subsegments',
    )
    if (crawlUpLeft) return crawlUpLeft
    const crawlUpRight = crawlUpAndCheckForImprovement(
      baseTextSubsegments,
      ttsSegments,
      crawlRange,
      bottomPairing,
      'ttsSegments',
    )
    if (crawlUpRight) return crawlUpRight
  }
}
function expandImprovementUp({
  baseTextSubsegments,
  ttsSegments,
  improvement,
  crawlRange,
}: {
  baseTextSubsegments: BaseTextSubsegment[]
  ttsSegments: TextToSpeechSegment[]
  improvement: Pairing
  crawlRange: {
    subsegments: { start: number; end: number }
    ttsSegments: { start: number; end: number }
  }
}) {
  const currentPairing = {
    subsegments: {
      start: improvement.subsegments.start,
      end: improvement.subsegments.end,
      // normalizedText: baseTextSubsegments[improvement.subsegments.start].normalizedText,
      normalizedText: getElementsInRange(baseTextSubsegments, {
        start: improvement.subsegments.start,
        end: improvement.subsegments.end,
      })
        .map((s) => s.normalizedText)
        .join(''),
    },
    ttsSegments: {
      start: improvement.ttsSegments.start,
      end: improvement.ttsSegments.end,
      // normalizedText: ttsSegments[improvement.ttsSegments.start].normalizedText,
      normalizedText: getElementsInRange(ttsSegments, {
        start: improvement.ttsSegments.start,
        end: improvement.ttsSegments.end,
      })
        .map((s) => s.normalizedText)
        .join(''),
    },
  }

  const crawlUpLeft = crawlUpAndCheckForImprovement(
    baseTextSubsegments,
    ttsSegments,
    crawlRange,
    currentPairing,
    'subsegments',
  )

  const crawlUpRight = crawlUpAndCheckForImprovement(
    baseTextSubsegments,
    ttsSegments,
    crawlRange,
    crawlUpLeft || currentPairing,
    'ttsSegments',
  )
  return crawlUpRight || crawlUpLeft || null
}

// Define a threshold for similarity, e.g., 60% similarity
const SIMILARITY_THRESHOLD = 0.8

function passesSimilarityThreshold(
  improvement: Pairing | null,
  similarityThreshold: number = SIMILARITY_THRESHOLD,
): boolean {
  if (!improvement) return false

  const subsegmentText = improvement.subsegments.normalizedText
  const ttsSegmentText = improvement.ttsSegments.normalizedText

  // Calculate the Levenshtein distance
  const distance = levenshtein.get(subsegmentText, ttsSegmentText)

  // Calculate the maximum possible length for normalization
  const maxLength = Math.max(subsegmentText.length, ttsSegmentText.length)

  // Calculate the similarity ratio
  const similarityRatio = (maxLength - distance) / maxLength

  return similarityRatio >= similarityThreshold
}
