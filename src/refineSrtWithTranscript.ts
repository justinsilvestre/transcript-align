import * as fs from 'fs'
import { parseSync, stringifySync, NodeCue } from 'subtitle'
import { findIndexBetween } from './findIndexBetween'
import { syncTranscriptWithSubtitles, SegmentChunkMatch, Unmatched, TranscriptSegment, SyncedTranscriptAndSubtitles } from './syncTranscriptWithSubtitles'
import { last } from './last'
import { rashomon } from './rashomon'

// const transcriptSegments = getCuesForTranscript(transcript, chunks)


export function refineSrtWithTranscript(srtText: string, synced: SyncedTranscriptAndSubtitles) {
  // TODO: get rid of any overlaps
  const chunks = parseSync(srtText)
    .filter((x): x is NodeCue => x.type === 'cue')
    .map((n, i) => ({
      text: n.data.text,
      index: i,
      data: n.data,
    }))
  // attach stray segments to next chunk
  const withoutStraySegments: Array<SegmentChunkMatch | Unmatched> = attachStraySegments(synced)

  const newSrtText = stringifySync(
    withoutStraySegments.map((x) => ({
      type: 'cue',
      data: {
        start: chunks[x.subtitlesChunkIndexes[0]].data.start,
        end: chunks[last(x.subtitlesChunkIndexes)].data.end,
        text: x.transcriptAtomIndexes
          .map((i) => synced.analyzedTranscript.atomAt(i).text)
          .join(''),
      },
    })),
    { format: 'SRT' },
  )
  const translationSrtText =  stringifySync(
    withoutStraySegments.map((x) => ({
      type: 'cue',
      data: {
        start: chunks[x.subtitlesChunkIndexes[0]].data.start,
        end: chunks[last(x.subtitlesChunkIndexes)].data.end,
        text: x.transcriptAtomIndexes
          .map((i) => {
            // TODO: fill in
            return ''
            // synced.analyzedTranscript.atomAt(i).translation
          })
          .join(''),
      },
    })),
    { format: 'SRT' },
  )


  translationSrtText

  console.log({ writingTo: __dirname + '../out.srt' })
  fs.writeFileSync(__dirname + '/../out.srt', newSrtText, 'utf8')
  fs.writeFileSync(__dirname + '/../out_translation.srt', translationSrtText, 'utf8')

  return withoutStraySegments
}

function attachStraySegments(synced: SyncedTranscriptAndSubtitles) {
  const { matches, unmatched, analyzedTranscript } =synced
  const itemsWithSubtitlesChunks: Array<SegmentChunkMatch | Unmatched> = [
    ...matches.filter((m) => m.subtitlesChunkIndexes.length),
    ...unmatched.filter((m) => m.subtitlesChunkIndexes.length),
  ].sort((a, b) => a.subtitlesChunkIndexes[0] - b.subtitlesChunkIndexes[0])

  const straySegmentsGroups: Array<SegmentChunkMatch | Unmatched> = unmatched
    .filter((m) => !m.subtitlesChunkIndexes.length)
    .sort((a, b) => analyzedTranscript.toAbsoluteAtomIndex(a.transcriptAtomIndexes[0]) - analyzedTranscript.toAbsoluteAtomIndex(b.transcriptAtomIndexes[0]))

  for (const straySegmentsGroup of straySegmentsGroups) {
    const nextTranscriptSegmentIndex = analyzedTranscript.toAbsoluteAtomIndex(last(straySegmentsGroup.transcriptAtomIndexes)) + 1
    // TODO: stragglers at end? start?
    const matchWithChunks = itemsWithSubtitlesChunks.find((x) =>
      x.transcriptAtomIndexes.some(i => analyzedTranscript.toAbsoluteAtomIndex(i) === nextTranscriptSegmentIndex),
    )
    if (matchWithChunks) {
      matchWithChunks.transcriptAtomIndexes = [
        ...straySegmentsGroup.transcriptAtomIndexes,
        ...matchWithChunks.transcriptAtomIndexes,
      ]
    }
  }
  return itemsWithSubtitlesChunks
}
