import * as levenshtein from 'fast-levenshtein'

type Cue = {
  transcriptStart: number
  transcriptEnd: number
  correspondingSegmentIndexes: number[]
}

type SegmentChunkMatch = {
  transcriptSegmentIndexes: number[]
  subtitlesChunkIndexes: number[]
  unmatchedBefore?: Unmatched
  unmatchedAfter?: Unmatched
}
type Unmatched = { transcriptSegments: { start: number; end: number }[]; subtitlesChunks: { text: string }[] }

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
  subtitlesChunks: { text: string }[],
  givenOptions: Options = defaultOptions,
): Cue[] {
  const options = {
    ...defaultOptions,
    ...givenOptions,
  }
  const transcriptSegments = getTranscriptSegments(transcript, options)
  const extremelyProbableMatches = getProbableMatches(
    transcriptSegments, transcript, subtitlesChunks, options.segmentationFirstPassAnchorLength, 2)

  const unresolvedSegmentsAndChunks = extremelyProbableMatches.flatMap((x) => x.unmatchedAfter || [])

  console.log(
    unresolvedSegmentsAndChunks.map((ur) => {
      const tr = ur.transcriptSegments.map((s) => transcript.slice(s.start, s.end))
      const su = ur.subtitlesChunks.map((s) => s.text)
      return { tr, su }
    }),
  )

  // group unresolved transcript segments + unresolved subs chunks
  // const unresolvedTranscriptSegmentGroups

  // in each group, try matching groups of chunks with groups? of segments

  return []
}

export function getProbableMatches(
  transcriptSegments: { start: number; end: number }[],
  transcript: string,
  subtitlesChunks: { text: string }[],
  minMatchLength: number,
  levenshteinThreshold: number,
) {

  const matches = transcriptSegments.reduce((matches, { start, end }, index) => {
    const segment = transcript.slice(start, end)

    const normalizedSegment = normalizeText(segment)
    if (normalizedSegment.length >= minMatchLength) {
      // const lastMatch = matches[matches.length - 1] || null
      // if (lastMatch)
      const subtitlesChunkMatchIndex = subtitlesChunks.findIndex(({ text }) => {
        const normalizedSubtitlesChunkSegment = normalizeText(text)
        // console.log({ normalizedSegment, normalizedSubtitlesChunkSegment})
        const distance = levenshtein.get(normalizedSegment, normalizedSubtitlesChunkSegment)
        // console.log(distance)

        return distance <= levenshteinThreshold
      })

      if (subtitlesChunkMatchIndex != -1) {
        matches.push({
          transcriptSegmentIndexes: [index],
          subtitlesChunkIndexes: [subtitlesChunkMatchIndex],
        })
      }
    }

    return matches
  }, [] as SegmentChunkMatch[])

  // fill in unresolved bits for later passes
  let i = 0
  for (const match of matches) {
    // TODO: before first
    const next = matches[i + 1] || null

    const unresolvedSegmentsAfterMatch = transcriptSegments.slice(
      match.transcriptSegmentIndexes[0] + 1,
      next ? next.transcriptSegmentIndexes[0] : transcriptSegments.length,
    )
    const unresolvedChunksAfterMatch = subtitlesChunks.slice(
      match.subtitlesChunkIndexes[0] + 1,
      next ? next.subtitlesChunkIndexes[0] : subtitlesChunks.length,
    )

    if (unresolvedSegmentsAfterMatch.length || unresolvedChunksAfterMatch.length) {
      match.unmatchedAfter = {
        transcriptSegments: unresolvedSegmentsAfterMatch,
        subtitlesChunks: unresolvedChunksAfterMatch,
      }
    }

    i++
  }

  return matches
}

function normalizeText(text: string) {
  return text
    .replace(NON_LETTERS_DIGITS, '')
    .replace(/[\s\n]+/, ' ')
    .trim()
}

export function getTranscriptSegments(transcript: string, options: Options = defaultOptions) {
  const transcriptSegmentsMatches = transcript.matchAll(options.transcriptSegmenters)
  const transcriptSegments = [...transcriptSegmentsMatches].map((match) => {
    return {
      start: match.index as number,
      end: ((match.index as number) + match[0].length) as number,
    }
  })

  return transcriptSegments
}

// first find relatively big/unique transcript chunks
//   use them to find big extremely probable matches (starting from both ends?)
// then between those, fill in less probable matches, trying different combinations/further segmentations?
