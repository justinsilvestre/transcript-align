import * as levenshtein from 'fast-levenshtein'
import { analyzeTranscript, AnalyzedTranscript, TranscriptAtomIndex, TranscriptSegmentInput } from './analyzeTranscript'
import { findIndexBetween } from './findIndexBetween'
import { last } from './last'

type SubtitlesChunk = {
  text: string
  index: number
}

export type SegmentChunkMatch = {
  /** always at least one present */
  transcriptAtomIndexes: TranscriptAtomIndex[]
  /** always at least one present */
  subtitlesChunkIndexes: number[]
  matched: true
}
export type Unmatched = {
  transcriptAtomIndexes: TranscriptAtomIndex[]
  subtitlesChunkIndexes: number[]
  matched: false
}

export type Options = {
  transcriptSegmenters: RegExp
  segmentationFirstPassAnchorLength: number
}

const NON_LETTERS_DIGITS_WHITESPACE_OR_END = /[\p{L}\p{N}]+[\s\p{L}\p{N}]*([^\p{L}\p{N}]+|$)/gu
const NON_LETTERS_DIGITS = /[^\p{L}\p{N}]/gu

export const defaultOptions = {
  transcriptSegmenters: NON_LETTERS_DIGITS_WHITESPACE_OR_END,
  segmentationFirstPassAnchorLength: 15,
}

export type SyncedTranscriptAndSubtitles = ReturnType<typeof syncTranscriptWithSubtitles>

export function syncTranscriptWithSubtitles(
  transcriptInput: TranscriptSegmentInput[],
  subtitlesChunks: SubtitlesChunk[],
  givenOptions: Options = defaultOptions,
) {
  const options = {
    ...defaultOptions,
    ...givenOptions,
  }

  const analyzedTranscript = analyzeTranscript(transcriptInput, options.transcriptSegmenters)

  // todo: clean up options--shouldnt be used everywhere now that segmentaiton is done outside
  const anchorMatches = getAnchorMatches(analyzedTranscript, subtitlesChunks, options)

  const minMatchLength = 10
  let penultimate = continueMatching(anchorMatches.matches, analyzedTranscript, subtitlesChunks, 10, 2)
  for (let i = 10; i >= minMatchLength; i--) {
    penultimate = continueMatching(penultimate.matches, analyzedTranscript, subtitlesChunks, i, 2)
  }


  const levenshteinThreshold = 10
  let final = continueMatching(penultimate.matches, analyzedTranscript, subtitlesChunks, 5, 3)
  for (let i = 3; i < levenshteinThreshold; i++) {
    final = continueMatching(final.matches, analyzedTranscript, subtitlesChunks, 5, i)

  }

  return {
    ...final,
    analyzedTranscript
  }
}

export function getAnchorMatches(
  transcript: AnalyzedTranscript,
  subtitlesChunks: SubtitlesChunk[],
  options: { transcriptSegmenters: RegExp; segmentationFirstPassAnchorLength: number } = defaultOptions,
) {
  return getProbableMatches(transcript, subtitlesChunks, {
    minMatchLength: options.segmentationFirstPassAnchorLength,
    levenshteinThreshold: 2,
    transcriptAtomsStartIndex: 0,
    transcriptAtomsEnd: transcript.atoms.length,
    subtitlesChunksStartIndex: 0,
    subtitlesChunksEnd: subtitlesChunks.length,
  })
}

function continueMatching(
  prevMatches: SegmentChunkMatch[],
  analyzedTranscript: AnalyzedTranscript,
  subtitlesChunks: SubtitlesChunk[],
  minMatchLength: number,
  levenshteinThreshold: number,
) {
  const matches: SegmentChunkMatch[] = []
  const unmatched: Unmatched[] = []
  let i = 0
  for (const match of prevMatches) {
    const previousMatch: SegmentChunkMatch | null = prevMatches[i - 1] || null
    const before = getProbableMatches(analyzedTranscript, subtitlesChunks, {
      minMatchLength,
      levenshteinThreshold,
      transcriptAtomsStartIndex: previousMatch
        ? last(previousMatch.transcriptAtomIndexes.map(i => analyzedTranscript.toAbsoluteAtomIndex(i))) + 1
        : 0,
      transcriptAtomsEnd: match.transcriptAtomIndexes.map(i => analyzedTranscript.toAbsoluteAtomIndex(i))[0],
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
  const unresolvedAtEnd = getProbableMatches(analyzedTranscript, subtitlesChunks, {
        minMatchLength,
        levenshteinThreshold,
        transcriptAtomsStartIndex: last(lastMatch.transcriptAtomIndexes.map(i => analyzedTranscript.toAbsoluteAtomIndex(i))) + 1,
        transcriptAtomsEnd: lastMatch
          ? analyzedTranscript.toAbsoluteAtomIndex(lastMatch.transcriptAtomIndexes[0])
          : analyzedTranscript.atoms.length,
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
  transcriptAtomsStartIndex: number
  transcriptAtomsEnd: number
  subtitlesChunksStartIndex: number
  subtitlesChunksEnd: number
}


export function getProbableMatches(
  transcript: AnalyzedTranscript,
  subtitlesChunks: SubtitlesChunk[],
  options: GetProbableMatchesOptions,
) {
  let first: SegmentChunkMatch | Unmatched | null = null
  const {
    minMatchLength,
    levenshteinThreshold,
    transcriptAtomsStartIndex,
    transcriptAtomsEnd,
    subtitlesChunksStartIndex,
    subtitlesChunksEnd,
  } = options
  const matches: SegmentChunkMatch[] = []
  const unmatched: Unmatched[] = []

  let searchStartIndex = subtitlesChunksStartIndex

  for (let index = transcriptAtomsStartIndex; index < transcriptAtomsEnd; index++) {
    const { text: segment } = transcript.atoms[index]

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
          transcriptAtomIndexes: [transcript.atoms[index].index],
          subtitlesChunkIndexes: [subtitlesChunkMatchIndex],
          matched: true,
        }

        const priorUnmatchedSegmentsStartIndex = previousMatch
          ? transcript.toAbsoluteAtomIndex(last(previousMatch.transcriptAtomIndexes)) + 1
          : transcriptAtomsStartIndex
        const priorUnmatchedChunksStartIndex = previousMatch
          ? last(previousMatch.subtitlesChunkIndexes) + 1
          : subtitlesChunksStartIndex
        const unresolvedSegmentsBeforeMatch = transcript.atoms.slice(
          // todo: what if emtpy?
          priorUnmatchedSegmentsStartIndex,
          transcript.toAbsoluteAtomIndex(match.transcriptAtomIndexes[0]),
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
              transcriptAtomIndexes: unresolvedSegmentsBeforeMatch.map((s) => s.index),
              subtitlesChunkIndexes: unresolvedChunksBeforeMatch.map((c) => c.index),
              matched: true,
            }
            if (!matches.length && !unmatched.length) first = newMatch
            matches.push(newMatch)
          } else {
            const unmatchedBefore: Unmatched = {
              transcriptAtomIndexes: unresolvedSegmentsBeforeMatch.map((s) => s.index),
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
    ? transcript.toAbsoluteAtomIndex(last(lastMatch.transcriptAtomIndexes)) + 1
    : transcriptAtomsStartIndex
  const unprocessedChunksStartIndex = lastMatch
    ? last(lastMatch.subtitlesChunkIndexes) + 1
    : subtitlesChunksStartIndex
  const unresolvedSegmentsAfterMatches = transcript.atoms.slice(unprocessedSegmentsStartIndex, transcriptAtomsEnd)
  const unresolvedChunksAfterMatches = subtitlesChunks.slice(unprocessedChunksStartIndex, subtitlesChunksEnd)
  if (unresolvedSegmentsAfterMatches.length || unresolvedChunksAfterMatches.length) {
    if (
      unresolvedSegmentsAfterMatches.length &&
      unresolvedChunksAfterMatches.length &&
      (unresolvedSegmentsAfterMatches.length === 1 || unresolvedChunksAfterMatches.length === 1)
    ) {
      matches.push({
        transcriptAtomIndexes: unresolvedSegmentsAfterMatches.map((s) => s.index),
        subtitlesChunkIndexes: unresolvedChunksAfterMatches.map((c) => c.index),
        matched: true,
      })
    } else {
      const unmatchedAfter: Unmatched = {
        matched: false,
        transcriptAtomIndexes: unresolvedSegmentsAfterMatches.map((s) => s.index),
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


