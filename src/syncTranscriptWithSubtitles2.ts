import * as lev from 'fast-levenshtein'
import { TranscriptSegmentInput, AnalyzedTranscript } from './analyzeTranscript'
import { findIndexBetween } from './findIndexBetween'
import { last } from './last'
import { normalizeText } from './normalizeText'

export type SearchResolutionItem = SearchDeadEnd | MatchGroup

type SearchDeadEnd = {
  type: 'SearchDeadEnd'
  reason: 'NoPotentialMatchesLeft' | 'NoMatchesFoundWithinParameters'
  params: SearchParams
  items: ChunkAtomCorrespondence
}
function getSearchDeadEnd(params: SearchParams, items: ChunkAtomCorrespondence): SearchDeadEnd[] {
  if (!items.subtitlesChunkIndexes.length && !items.transcriptAtomIndexes.length) return []
  if (!items.subtitlesChunkIndexes.length || !items.transcriptAtomIndexes.length) return [{
    type: 'SearchDeadEnd',
    params,
    items,
    reason: 'NoPotentialMatchesLeft',
  }]

  return [
    {
      type: 'SearchDeadEnd',
      params,
      items,
      reason: 'NoMatchesFoundWithinParameters'
    },
  ]
}

type MatchGroup = {
  type: 'MatchGroup'
  params: SearchParams
  items: ChunkAtomCorrespondence
}

type ChunkAtomCorrespondence = {
  subtitlesChunkIndexes: number[]
  transcriptAtomIndexes: number[]
}

export function getMatchSearchArea(
  subtitlesChunkIndexes: number[],
  transcriptAtomIndexes: number[],
): ChunkAtomCorrespondence {
  return { subtitlesChunkIndexes, transcriptAtomIndexes }
}

type SubtitlesChunk = {
  text: string
  index: number
}

const NON_LETTERS_DIGITS_WHITESPACE_OR_END = /[\p{L}\p{N}]+[\s\p{L}\p{N}]*([^\p{L}\p{N}]+|$)/gu

const defaultTranscriptSegmenter = NON_LETTERS_DIGITS_WHITESPACE_OR_END

export type SyncResult = {
  analyzedTranscript: AnalyzedTranscript
  searched: SearchResolutionItem[]
}

export function syncTranscriptWithSubtitles(
  transcriptInput: TranscriptSegmentInput[],
  subtitlesChunks: SubtitlesChunk[],
): SyncResult {
  const analyzedTranscript = analyzeTranscript(transcriptInput, defaultTranscriptSegmenter)

  const initialSearchArea = getMatchSearchArea(
    subtitlesChunks.map((c) => c.index),
    analyzedTranscript.atoms.map((a) => a.absoluteIndex),
  )

  const searched = findMatches(initialSearchArea, 0, {
    subtitlesChunks,
    transcript: analyzedTranscript,
    searchParamsProgression: [
      [2, 15],
      [2, 14],
      [2, 13],
      [2, 12],
      [2, 11],
      [2, 10],
      [2, 9],
      [2, 8],
      [2, 7],
      [2, 6],
      [2, 5],
      [2, 4],
      [2, 3],
      [2, 5], // TODO: clean up
      [4, 6],
      [5, 8],
      [6, 12],
    ],
  })

  return {
    analyzedTranscript,
    searched,
  }
}

export function analyzeTranscript(
  transcriptSegmentsInput: TranscriptSegmentInput[],
  transcriptSegmenter: RegExp,
): AnalyzedTranscript {
  return new AnalyzedTranscript(transcriptSegmentsInput, transcriptSegmenter)
}

type FindMatchesOptions = {
  searchParamsProgression: SearchParams[]
  transcript: AnalyzedTranscript
  subtitlesChunks: SubtitlesChunk[]
}
type SearchParams = [LevenshteinThreshold, MinMatchLength]
type LevenshteinThreshold = number
type MinMatchLength = number

export function findMatches(
  searchArea: ChunkAtomCorrespondence,
  searchRound: number,
  options: FindMatchesOptions,
): SearchResolutionItem[] {
  // console.log('minMatchLength', options.searchParamsProgression[searchRound]?.[1])
  const searchParams: SearchParams | null = options.searchParamsProgression[searchRound]

  if (!searchArea) return []
  if (!searchArea.subtitlesChunkIndexes.length && !searchArea.transcriptAtomIndexes.length) {
    return []
  } else if (!searchArea.subtitlesChunkIndexes.length || !searchArea.transcriptAtomIndexes.length) {
    return getSearchDeadEnd(searchParams, searchArea)
  }
  // if (!searchParams) return [{
  //   type: 'SearchDeadEnd', items: searchArea, params: searchParams
  // }]

  const [levenshteinThreshold, minMatchLength] = searchParams
  const allChunks = options.subtitlesChunks
  const allAtoms = options.transcript.atoms

  // find matches
  const matches: SearchResolutionItem[] = []
  for (const subtitlesChunkIndex of searchArea.subtitlesChunkIndexes) {
    const lastMatchInSearchGroup: SearchResolutionItem | null = last(matches) || null
    const transcriptSearchStart = lastMatchInSearchGroup
      ? last(lastMatchInSearchGroup.items.transcriptAtomIndexes) + 1
      : searchArea.transcriptAtomIndexes[0]

    const normalizedChunkText = normalizeText(options.subtitlesChunks[subtitlesChunkIndex].text)

    // const transcriptSearchStartIndexIsWithinBounds = transcriptSearchStart < last(searchArea.transcriptAtomIndexes)
    // if (!transcriptSearchStartIndexIsWithinBounds) continue

    if (normalizedChunkText.length >= minMatchLength) {
      const transcriptAtomMatchIndex = findIndexBetween(
        allAtoms,
        transcriptSearchStart,
        last(searchArea.transcriptAtomIndexes) + 1,
        (atom) => {
          const normalizedAtomText = normalizeText(atom.text)

          return lev.get(normalizedChunkText, normalizedAtomText) <= levenshteinThreshold
        },
      )

      const matchWasFound = transcriptAtomMatchIndex !== -1
      if (matchWasFound) {
        const priorUnmatchedSubtitlesChunkIndexesStart = lastMatchInSearchGroup
          ? last(lastMatchInSearchGroup.items.subtitlesChunkIndexes) + 1
          : searchArea.subtitlesChunkIndexes[0]
        const priorUnmatchedSubtitlesChunkIndexes = allChunks
          // .slice(priorUnmatchedSubtitlesChunkIndexesStart, subtitlesChunkIndex + 1)
          .slice(priorUnmatchedSubtitlesChunkIndexesStart, subtitlesChunkIndex)
          .map((s) => s.index)

        const priorUnmatchedTranscriptAtomIndexes = allAtoms
          // .slice(transcriptSearchStart, transcriptAtomMatchIndex + 1)
          .slice(transcriptSearchStart, transcriptAtomMatchIndex)
          .map((s) => s.absoluteIndex)

        const unmatchedBefore = getMatchSearchArea(
          priorUnmatchedSubtitlesChunkIndexes,
          priorUnmatchedTranscriptAtomIndexes,
        )

        matches.push(
          ...(options.searchParamsProgression[searchRound + 1]
            ? findMatches(unmatchedBefore, searchRound + 1, options)
            : getSearchDeadEnd(searchParams, unmatchedBefore)),
          {
            type: 'MatchGroup',
            params: searchParams,
            items: {
              subtitlesChunkIndexes: [subtitlesChunkIndex],
              transcriptAtomIndexes: [transcriptAtomMatchIndex],
            },
          },
        )
      }
    }
  }

  // if (!matches.length) {
  //   return options.searchParamsProgression[searchRound + 1]
  //     ? findMatches(searchArea, searchRound + 1, options)
  //     :
  // }

  const lastMatchInSearchGroup: SearchResolutionItem | null = last(matches) || null

  const transcriptSearchStart = lastMatchInSearchGroup
    ? last(lastMatchInSearchGroup.items.transcriptAtomIndexes) + 1
    : searchArea.transcriptAtomIndexes[0]
  const transcriptSearchStartIndexIsWithinBounds = transcriptSearchStart <= last(searchArea.transcriptAtomIndexes)
  const finalUnmatchedTranscriptAtomIndexes: number[] = transcriptSearchStartIndexIsWithinBounds
    ? allAtoms.slice(transcriptSearchStart, last(searchArea.transcriptAtomIndexes) + 1).map((a) => a.absoluteIndex)
    : []

  const subtitlesSearchStart = lastMatchInSearchGroup
    ? last(lastMatchInSearchGroup.items.subtitlesChunkIndexes) + 1
    : searchArea.subtitlesChunkIndexes[0]
  const subtitlesSearchStartIndexIsInWithinBounds = subtitlesSearchStart <= last(searchArea.subtitlesChunkIndexes)
  const finalUnmatchedSubtitlesChunkIndexes: number[] = subtitlesSearchStartIndexIsInWithinBounds
    ? allChunks.slice(subtitlesSearchStart, last(searchArea.subtitlesChunkIndexes) + 1).map((c) => c.index)
    : []

  const finalUnmatched = getMatchSearchArea(finalUnmatchedSubtitlesChunkIndexes, finalUnmatchedTranscriptAtomIndexes)
  const finalMaybeMatched: SearchResolutionItem[] =
    // findMatches(finalUnmatched, searchRound + 1, options)
    options.searchParamsProgression[searchRound + 1]
      ? findMatches(finalUnmatched, searchRound + 1, options)
      : getSearchDeadEnd(searchParams, finalUnmatched)
      
      // finalUnmatched.transcriptAtomIndexes.length && finalUnmatched.subtitlesChunkIndexes.length
      // ? [
      //     {
      //       type: 'SearchDeadEnd',
      //       reason: 'NoMatchesFoundWithinParameters',
      //       params: searchParams,
      //       items: finalUnmatched,
      //     },
      //   ]
      // : []

  return [...matches, ...finalMaybeMatched]
}
