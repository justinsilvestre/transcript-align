import * as levenshtein from 'fast-levenshtein'

type SegmentChunkMatch = {
  /** always at least one present */
  transcriptSegmentIndexes: number[]
  /** always at least one present */
  subtitlesChunkIndexes: number[]
}
type Unmatched = {
  transcriptSegments: { start: number; end: number; index: number }[]
  subtitlesChunks: { text: string }[]
}

type Options = {
  transcriptSegmenters: RegExp
  segmentationFirstPassAnchorLength: number
}

const NON_LETTERS_DIGITS_WHITESPACE_OR_END = /[\p{L}\p{N}]+[\s\p{L}\p{N}]*([^\p{L}\p{N}]+|$)/gu
const NON_LETTERS_DIGITS = /[^\p{L}\p{N}]/gu
const defaultOptions = {
  transcriptSegmenters: NON_LETTERS_DIGITS_WHITESPACE_OR_END,
  segmentationFirstPassAnchorLength: 15,
}

export function getCuesForTranscript(
  transcript: string,
  subtitlesChunks: { text: string; index: number }[],
  givenOptions: Options = defaultOptions,
) {
  const options = {
    ...defaultOptions,
    ...givenOptions,
  }
  const transcriptSegments = getTranscriptSegments(transcript, options)
  const anchorMatches = getAnchorMatches(transcriptSegments, transcript, subtitlesChunks, options)

  const secondPass = continueMatching(anchorMatches, transcriptSegments, transcript, subtitlesChunks, 10, 2)
  const thirdPass = continueMatching(secondPass, transcriptSegments, transcript, subtitlesChunks, 9, 2)
  const fourthPass = continueMatching(thirdPass, transcriptSegments, transcript, subtitlesChunks, 8, 2)
  const fifthPass = continueMatching(fourthPass, transcriptSegments, transcript, subtitlesChunks, 7, 2)
  const sixthPass = continueMatching(fifthPass, transcriptSegments, transcript, subtitlesChunks, 6, 2)
  const seventhPass = continueMatching(sixthPass, transcriptSegments, transcript, subtitlesChunks, 5, 2)
  const eighthPass = continueMatching(seventhPass, transcriptSegments, transcript, subtitlesChunks, 4, 2)
  const ninthPass = continueMatching(eighthPass, transcriptSegments, transcript, subtitlesChunks, 3, 2)

  const tenthPass = continueMatching(ninthPass, transcriptSegments, transcript, subtitlesChunks, 5, 3)
  const eleventhPass = continueMatching(tenthPass, transcriptSegments, transcript, subtitlesChunks, 5, 4)
  const twelfthPass = continueMatching(eleventhPass, transcriptSegments, transcript, subtitlesChunks, 5, 5)
  const thirteenthPass = continueMatching(twelfthPass, transcriptSegments, transcript, subtitlesChunks, 5, 6)

  // first find longest? tiny-distance matches
  // then try different combinations/concatenations.
  // repeat with higher and higher distance thresholds.

  const final = thirteenthPass

  const unresolvedSegmentsAndChunks = final.unmatched

  const logMatches = final.matches

  console.log(
    unresolvedSegmentsAndChunks.map((ur) => {
      const tr = ur.transcriptSegments.map((s) => transcript.slice(s.start, s.end))
      const su = ur.subtitlesChunks.map((s) => s.text)
      return { tr, su }
    }),
  )
  console.log(logMatches)

  // group unresolved transcript segments + unresolved subs chunks
  // const unresolvedTranscriptSegmentGroups

  // in each group, try matching groups of chunks with groups? of segments

  return final
}

export function getAnchorMatches(
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: { text: string; index: number }[],
  options: { transcriptSegmenters: RegExp; segmentationFirstPassAnchorLength: number } = defaultOptions,
) {
  return getProbableMatches(transcriptSegments, transcript, subtitlesChunks, {
    minMatchLength: options.segmentationFirstPassAnchorLength,
    levenshteinThreshold: 2,
    transcriptSegmentsStartIndex: 0,
    transcriptSegmentsEnd: transcriptSegments.length,
    subtitlesChunksStartIndex: 0,
    subtitlesChunksEnd: subtitlesChunks.length,
  })
}

function continueMatching(
  prevMatches: { matches: SegmentChunkMatch[]; unmatched: Unmatched[] },
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: { text: string; index: number }[],
  minMatchLength: number,
  levenshteinThreshold: number,
) {
  const matches: SegmentChunkMatch[] = []
  const unmatched: Unmatched[] = []
  let i = 0
  for (const match of prevMatches.matches) {
    const previousMatch: SegmentChunkMatch | null = prevMatches.matches[i - 1] || null
    const nextMatch: SegmentChunkMatch | null = prevMatches.matches[i + 1] || null
    const before = getProbableMatches(transcriptSegments, transcript, subtitlesChunks, {
      minMatchLength,
      levenshteinThreshold,
      transcriptSegmentsStartIndex: previousMatch
        ? previousMatch.transcriptSegmentIndexes[previousMatch.transcriptSegmentIndexes.length - 1] + 1
        : 0,
      transcriptSegmentsEnd: match.transcriptSegmentIndexes[0],
      subtitlesChunksStartIndex: previousMatch
        ? previousMatch.subtitlesChunkIndexes[previousMatch.subtitlesChunkIndexes.length - 1] + 1
        : 0,
      subtitlesChunksEnd: match.subtitlesChunkIndexes[0],
    })
    // const after: any = null
    const after =
      i === prevMatches.matches.length - 1
        ? getProbableMatches(transcriptSegments, transcript, subtitlesChunks, {
            minMatchLength,
            levenshteinThreshold,
            transcriptSegmentsStartIndex: match.transcriptSegmentIndexes[match.transcriptSegmentIndexes.length - 1] + 1,
            transcriptSegmentsEnd: nextMatch ? nextMatch.transcriptSegmentIndexes[0] : transcriptSegments.length,
            subtitlesChunksStartIndex: match.subtitlesChunkIndexes[match.subtitlesChunkIndexes.length - 1] + 1,
            subtitlesChunksEnd: nextMatch ? nextMatch.subtitlesChunkIndexes[0] : subtitlesChunks.length,
          })
        : null
    matches.push(...before.matches, match, ...(after?.matches || []))
    unmatched.push(...before.unmatched, ...(after?.unmatched || []))

    i++
  }
  return { matches, unmatched }
}

export function getProbableMatches(
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: { text: string; index: number }[],
  options: {
    minMatchLength: number
    levenshteinThreshold: number
    transcriptSegmentsStartIndex: number
    transcriptSegmentsEnd: number
    subtitlesChunksStartIndex: number
    subtitlesChunksEnd: number
  },
) {
  const {
    minMatchLength,
    levenshteinThreshold,
    transcriptSegmentsStartIndex,
    transcriptSegmentsEnd,
    subtitlesChunksStartIndex,
    subtitlesChunksEnd,
  } = options
  const matches: SegmentChunkMatch[] = []
  const unmatched: Unmatched[] = []

  for (let index = transcriptSegmentsStartIndex; index < transcriptSegmentsEnd; index++) {
    const { start, end } = transcriptSegments[index]
    const segment = transcript.slice(start, end)

    const normalizedSegment = normalizeText(segment)
    if (normalizedSegment.length >= minMatchLength) {
      const subtitlesChunkMatchIndex = findIndexBetween(
        subtitlesChunks,
        subtitlesChunksStartIndex,
        subtitlesChunksEnd,
        ({ text }) => {
          const normalizedSubtitlesChunkSegment = normalizeText(text)
          const distance = levenshtein.get(normalizedSegment, normalizedSubtitlesChunkSegment)
          return distance <= levenshteinThreshold
        },
      )

      const matchFound = subtitlesChunkMatchIndex != -1
      if (matchFound) {
        const match = {
          transcriptSegmentIndexes: [index],
          subtitlesChunkIndexes: [subtitlesChunkMatchIndex],
        }

        const previousMatch = matches[matches.length - 1]
        const priorUnmatchedSegmentsStartIndex = previousMatch
          ? previousMatch.transcriptSegmentIndexes[previousMatch.transcriptSegmentIndexes.length - 1] + 1
          : transcriptSegmentsStartIndex
        const priorUnmatchedChunksStartIndex = previousMatch
          ? previousMatch.subtitlesChunkIndexes[previousMatch.subtitlesChunkIndexes.length - 1] + 1
          : subtitlesChunksStartIndex
        const unresolvedSegmentsBeforeMatch = transcriptSegments.slice(
          // todo: what if emtpy?
          priorUnmatchedSegmentsStartIndex,
          match.transcriptSegmentIndexes[0],
        )
        const unresolvedChunksBeforeMatch = subtitlesChunks.slice(
          priorUnmatchedChunksStartIndex,
          match.subtitlesChunkIndexes[0],
        )
        if (unresolvedSegmentsBeforeMatch.length || unresolvedChunksBeforeMatch.length) {
          if (
            unresolvedSegmentsBeforeMatch.length &&
            unresolvedChunksBeforeMatch.length &&
            (unresolvedSegmentsBeforeMatch.length === 1 || unresolvedChunksBeforeMatch.length === 1)
          ) {
            matches.push({
              transcriptSegmentIndexes: unresolvedSegmentsBeforeMatch.map((s) => s.index),
              subtitlesChunkIndexes: unresolvedChunksBeforeMatch.map((c) => c.index),
            })
          } else {
            const unmatchedBefore = {
              transcriptSegments: unresolvedSegmentsBeforeMatch,
              subtitlesChunks: unresolvedChunksBeforeMatch,
            }
            unmatched.push(unmatchedBefore)
          }
        }

        matches.push(match)
      }
    }
  }

  const lastMatch: SegmentChunkMatch | null = matches[matches.length - 1] || null
  const unprocessedSegmentsStartIndex = lastMatch
    ? lastMatch.transcriptSegmentIndexes[lastMatch.transcriptSegmentIndexes.length - 1] + 1
    : transcriptSegmentsStartIndex
  const unprocessedChunksStartIndex = lastMatch
    ? lastMatch.subtitlesChunkIndexes[lastMatch.subtitlesChunkIndexes.length - 1] + 1
    : subtitlesChunksStartIndex
  const unresolvedSegmentsAfterMatches = transcriptSegments.slice(unprocessedSegmentsStartIndex, transcriptSegmentsEnd)
  const unresolvedChunksAfterMatches = subtitlesChunks.slice(unprocessedChunksStartIndex, subtitlesChunksEnd)
  if (unresolvedSegmentsAfterMatches.length || unresolvedChunksAfterMatches.length) {
    if (
      unresolvedSegmentsAfterMatches.length &&
      unresolvedChunksAfterMatches.length &&
      (unresolvedSegmentsAfterMatches.length === 1 || unresolvedChunksAfterMatches.length === 1)
    ) {
      matches.push({
        transcriptSegmentIndexes: unresolvedSegmentsAfterMatches.map((s) => s.index),
        subtitlesChunkIndexes: unresolvedChunksAfterMatches.map((c) => c.index),
      })
    } else {
      const unmatchedAfter = {
        transcriptSegments: unresolvedSegmentsAfterMatches,
        subtitlesChunks: unresolvedChunksAfterMatches,
      }
      unmatched.push(unmatchedAfter)
    }
  }

  return {
    matches,
    unmatched,
  }
}

function normalizeText(text: string) {
  return text
    .replace(NON_LETTERS_DIGITS, '')
    .replace(/[\s\n]+/, ' ')
    .trim()
}

export function getTranscriptSegments(transcript: string, options: Options = defaultOptions) {
  const transcriptSegmentsMatches = transcript.matchAll(options.transcriptSegmenters)
  const transcriptSegments = [...transcriptSegmentsMatches].map((match, index) => {
    return {
      start: match.index as number,
      end: ((match.index as number) + match[0].length) as number,
      index,
    }
  })

  return transcriptSegments
}

// first find relatively big/unique transcript chunks
//   use them to find big extremely probable matches (starting from both ends?)
// then between those, fill in less probable matches, trying different combinations/further segmentations?

function findIndexBetween<T>(arr: T[], startIndex: number, end: number, predicate: (el: T) => boolean): number {
  for (let i = startIndex; i < end; i++) {
    if (predicate(arr[i])) return i
  }
  return -1
}
