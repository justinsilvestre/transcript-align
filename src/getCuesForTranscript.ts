import * as levenshtein from 'fast-levenshtein'
import { findIndexBetween } from './findIndexBetween'
import { last } from './last'

type SubtitlesChunk = {
  text: string
  index: number
}

export type SegmentChunkMatch = {
  /** always at least one present */
  transcriptSegmentIndexes: number[]
  /** always at least one present */
  subtitlesChunkIndexes: number[]
  matched: true
}
export type Unmatched = {
  transcriptSegmentIndexes: number[]
  subtitlesChunkIndexes: number[]
  matched: false
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
  subtitlesChunks: SubtitlesChunk[],
  givenOptions: Options = defaultOptions,
) {
  const options = {
    ...defaultOptions,
    ...givenOptions,
  }
  const transcriptSegments = getTranscriptSegments(transcript, options)
  const anchorMatches = getAnchorMatches(transcriptSegments, transcript, subtitlesChunks, options)

  const secondPass = continueMatching(anchorMatches.matches, transcriptSegments, transcript, subtitlesChunks, 10, 2)
  const thirdPass = continueMatching(secondPass.matches, transcriptSegments, transcript, subtitlesChunks, 9, 2)
  const fourthPass = continueMatching(thirdPass.matches, transcriptSegments, transcript, subtitlesChunks, 8, 2)
  const fifthPass = continueMatching(fourthPass.matches, transcriptSegments, transcript, subtitlesChunks, 7, 2)
  const sixthPass = continueMatching(fifthPass.matches, transcriptSegments, transcript, subtitlesChunks, 6, 2)
  const seventhPass = continueMatching(sixthPass.matches, transcriptSegments, transcript, subtitlesChunks, 5, 2)
  const eighthPass = continueMatching(seventhPass.matches, transcriptSegments, transcript, subtitlesChunks, 4, 2)
  const ninthPass = continueMatching(eighthPass.matches, transcriptSegments, transcript, subtitlesChunks, 3, 2)

  const tenthPass = continueMatching(ninthPass.matches, transcriptSegments, transcript, subtitlesChunks, 5, 3)
  const eleventhPass = continueMatching(tenthPass.matches, transcriptSegments, transcript, subtitlesChunks, 5, 4)
  const twelfthPass = continueMatching(eleventhPass.matches, transcriptSegments, transcript, subtitlesChunks, 5, 5)
  const thirteenthPass = continueMatching(twelfthPass.matches, transcriptSegments, transcript, subtitlesChunks, 5, 6)

  const final = thirteenthPass

  return {
    ...final,
    transcriptSegments
  }
}

export function getAnchorMatches(
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: SubtitlesChunk[],
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
  prevMatches: SegmentChunkMatch[],
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: SubtitlesChunk[],
  minMatchLength: number,
  levenshteinThreshold: number,
) {
  const matches: SegmentChunkMatch[] = []
  const unmatched: Unmatched[] = []
  let i = 0
  for (const match of prevMatches) {
    const previousMatch: SegmentChunkMatch | null = prevMatches[i - 1] || null
    const before = getProbableMatches(transcriptSegments, transcript, subtitlesChunks, {
      minMatchLength,
      levenshteinThreshold,
      transcriptSegmentsStartIndex: previousMatch
        ? last(previousMatch.transcriptSegmentIndexes) + 1
        : 0,
      transcriptSegmentsEnd: match.transcriptSegmentIndexes[0],
      subtitlesChunksStartIndex: previousMatch
        ? last(previousMatch.subtitlesChunkIndexes) + 1
        : 0,
      subtitlesChunksEnd: match.subtitlesChunkIndexes[0],
    })

    matches.push(...(before?.matches || []), match)
    unmatched.push(...(before?.unmatched || []))

    i++
  }

  const lastMatch = last(prevMatches)
  const unresolvedAtEnd = getProbableMatches(transcriptSegments, transcript, subtitlesChunks, {
        minMatchLength,
        levenshteinThreshold,
        transcriptSegmentsStartIndex: last(lastMatch.transcriptSegmentIndexes) + 1,
        transcriptSegmentsEnd: lastMatch ? lastMatch.transcriptSegmentIndexes[0] : transcriptSegments.length,
        subtitlesChunksStartIndex: last(lastMatch.subtitlesChunkIndexes)+ 1,
        subtitlesChunksEnd: lastMatch ? lastMatch.subtitlesChunkIndexes[0] : subtitlesChunks.length,
      })
  matches.push(...unresolvedAtEnd.matches)
  unmatched.push(...unresolvedAtEnd.unmatched)

  return { matches, unmatched }
}

type GetProbableMatchesOptions = {
  minMatchLength: number
  levenshteinThreshold: number
  transcriptSegmentsStartIndex: number
  transcriptSegmentsEnd: number
  subtitlesChunksStartIndex: number
  subtitlesChunksEnd: number
}

export function getProbableMatches(
  transcriptSegments: { start: number; end: number; index: number }[],
  transcript: string,
  subtitlesChunks: SubtitlesChunk[],
  options: GetProbableMatchesOptions,
) {
  let first: SegmentChunkMatch | Unmatched | null = null
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

  let searchStartIndex = subtitlesChunksStartIndex

  for (let index = transcriptSegmentsStartIndex; index < transcriptSegmentsEnd; index++) {
    const { start, end } = transcriptSegments[index]
    const segment = transcript.slice(start, end)

    const normalizedSegment = normalizeText(segment)
    if (normalizedSegment.length >= minMatchLength) {
      const subtitlesChunkMatchIndex = findIndexBetween(
        subtitlesChunks,
        searchStartIndex,
        subtitlesChunksEnd,
        ({ text }) => {
          const normalizedSubtitlesChunkSegment = normalizeText(text)
          const distance = levenshtein.get(normalizedSegment, normalizedSubtitlesChunkSegment)
          return distance <= levenshteinThreshold
        },
      )

      const matchFound = subtitlesChunkMatchIndex !== -1

      if (matchFound) {
        // immediately flag the matched subtitleschunks as already processed
        searchStartIndex = subtitlesChunkMatchIndex + 1
        const previousMatch = matches[matches.length - 1]
        const match: SegmentChunkMatch = {
          transcriptSegmentIndexes: [index],
          subtitlesChunkIndexes: [subtitlesChunkMatchIndex],
          matched: true,
        }

        const priorUnmatchedSegmentsStartIndex = previousMatch
          ? last(previousMatch.transcriptSegmentIndexes) + 1
          : transcriptSegmentsStartIndex
        const priorUnmatchedChunksStartIndex = previousMatch
          ? last(previousMatch.subtitlesChunkIndexes) + 1
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
            const newMatch: SegmentChunkMatch = {
              transcriptSegmentIndexes: unresolvedSegmentsBeforeMatch.map((s) => s.index),
              subtitlesChunkIndexes: unresolvedChunksBeforeMatch.map((c) => c.index),
              matched: true,
            }
            if (!matches.length && !unmatched.length) first = newMatch
            matches.push(newMatch)
          } else {
            const unmatchedBefore: Unmatched = {
              transcriptSegmentIndexes: unresolvedSegmentsBeforeMatch.map((s) => s.index),
              subtitlesChunkIndexes: unresolvedChunksBeforeMatch.map((c) => c.index),
              matched: false,
            }
            if (!matches.length && !unmatched.length) first = unmatchedBefore
            unmatched.push(unmatchedBefore)
          }
        }

            if (!matches.length && !unmatched.length) first = match
            matches.push(match)
      }
    }
  }

  const lastMatch: SegmentChunkMatch | null = last(matches) || null
  const unprocessedSegmentsStartIndex = lastMatch
    ? last(lastMatch.transcriptSegmentIndexes) + 1
    : transcriptSegmentsStartIndex
  const unprocessedChunksStartIndex = lastMatch
    ? last(lastMatch.subtitlesChunkIndexes) + 1
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
        matched: true,
      })
    } else {
      const unmatchedAfter: Unmatched = {
        matched: false,
        transcriptSegmentIndexes: unresolvedSegmentsAfterMatches.map((s) => s.index),
        subtitlesChunkIndexes: unresolvedChunksAfterMatches.map((s) => s.index),
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
