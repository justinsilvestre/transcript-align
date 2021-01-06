import * as lev from 'fast-levenshtein'
import { TranscriptSegmentInput, AnalyzedTranscript } from './analyzeTranscript'
import { findIndexBetween } from './findIndexBetween'
import { last } from './last'
import { normalizeText } from './normalizeText'

export const NON_LETTERS_DIGITS = /[^\p{L}\p{N}]/gu

// TODO: try finding matches by combining bits to fix cases like:
// NoMatchesFoundWithinParameters 6,12    subs: --Pagkaalis nila Adan at Eva sa hardin ng Eden nagkaroon sila ng maraming anak
// --Ang panganay nilang si cain ay naging magsasaka at ang ikalawang anak na si Abel ay naging tagapag-alaga
// --Hayop
// trscpt: --Pagkaalis nina Adan at Eva sa hardin ng Eden, 
// --nagkaroon sila ng maraming anak.
// --Ang panganay nilang si Cain ay naging magsasaka, 
// --at ang ikalawang anak na si Abel ay naging tagapag-
// --alaga ng hayop.

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

export type SubtitlesChunk = {
  text: string
  index: number
}

const NON_LETTERS_DIGITS_WHITESPACE_OR_END = /[\p{L}\p{N}]+[\s\p{L}\p{N}]*([^\p{L}\p{N}]+|$)/gu

export const defaultTranscriptSegmenter = NON_LETTERS_DIGITS_WHITESPACE_OR_END

export type SyncResult = {
  analyzedTranscript: AnalyzedTranscript
  matches: SearchResolutionItem[]
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

  // TODO: the longer the match query items, the bigger the threshold should be
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
        ...[...Array(25).keys()].map(k => (30 + 15) - k).map((n) => {
        return [(2/5) * n, n] as [number, number]
      }),
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
    matches: searched,
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
  completedSearchPasses: number,
  options: FindMatchesOptions,
): SearchResolutionItem[] {
  const searchParams: SearchParams | null = options.searchParamsProgression[completedSearchPasses]

  if (!searchArea) return []
  if (!searchArea.subtitlesChunkIndexes.length && !searchArea.transcriptAtomIndexes.length) {
    return []
  } else if (!searchArea.subtitlesChunkIndexes.length || !searchArea.transcriptAtomIndexes.length) {
    return getSearchDeadEnd(searchParams, searchArea)
  }

  // TODO: consider this instead of manually making sure searchRound param is valid
  // if (!searchParams) return getSearchDeadEnd(searchParams, items)
  // return [{
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

    // TODO: is something like this necessary?
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
          .slice(priorUnmatchedSubtitlesChunkIndexesStart, subtitlesChunkIndex)
          .map((s) => s.index)

        const priorUnmatchedTranscriptAtomIndexes = allAtoms
          .slice(transcriptSearchStart, transcriptAtomMatchIndex)
          .map((s) => s.absoluteIndex)

        const unmatchedBefore = getMatchSearchArea(
          priorUnmatchedSubtitlesChunkIndexes,
          priorUnmatchedTranscriptAtomIndexes,
        )

        matches.push(
          ...(options.searchParamsProgression[completedSearchPasses + 1]
            ? findMatches(unmatchedBefore, completedSearchPasses + 1, options)
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
    options.searchParamsProgression[completedSearchPasses + 1]
      ? findMatches(finalUnmatched, completedSearchPasses + 1, options)
      : getSearchDeadEnd(searchParams, finalUnmatched)

  return [...matches, ...finalMaybeMatched]
}
