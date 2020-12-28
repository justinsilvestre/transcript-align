import * as fs from 'fs'
import { parseSync, stringifySync, NodeCue } from 'subtitle'
import { findIndexBetween } from './findIndexBetween'
import { getCuesForTranscript, SegmentChunkMatch, Unmatched } from './getCuesForTranscript'
import { last } from './last'
import { rashomon } from './rashomon'

export function refineSrtWithTranscript(srtText: string, transcript: string) {
  // TODO: get rid of any overlaps
  const chunks = parseSync(srtText)
    .filter((x): x is NodeCue => x.type === 'cue')
    .map((n, i) => ({
      text: n.data.text,
      index: i,
      data: n.data,
    }))
  // TODO: rename
  const cues = getCuesForTranscript(transcript, chunks)
  // attach stray segments to next chunk
  const withoutStraySegments: Array<SegmentChunkMatch | Unmatched> = attachStraySegments(cues.matches, cues.unmatched)

  const newSrtText = stringifySync(
    withoutStraySegments.map((x) => ({
      type: 'cue',
      data: {
        start: chunks[x.subtitlesChunkIndexes[0]].data.start,
        end: chunks[last(x.subtitlesChunkIndexes)].data.end,
        text: x.transcriptSegmentIndexes
          .map((i) => transcript.slice(cues.transcriptSegments[i].start, cues.transcriptSegments[i].end))
          .join(''),
      },
    })),
    { format: 'SRT' },
  )

  console.log({ writingTo: __dirname + '../out.srt' })
  fs.writeFileSync(__dirname + '/../out.srt', newSrtText, 'utf8')

  return withoutStraySegments
}

function attachStraySegments(matches: SegmentChunkMatch[], unmatched: Unmatched[]) {
  const itemsWithSubtitlesChunks: Array<SegmentChunkMatch | Unmatched> = [
    ...matches.filter((m) => m.subtitlesChunkIndexes.length),
    ...unmatched.filter((m) => m.subtitlesChunkIndexes.length),
  ].sort((a, b) => a.subtitlesChunkIndexes[0] - b.subtitlesChunkIndexes[0])

  const straySegmentsGroups: Array<SegmentChunkMatch | Unmatched> = unmatched
    .filter((m) => !m.subtitlesChunkIndexes.length)
    .sort((a, b) => a.transcriptSegmentIndexes[0] - b.transcriptSegmentIndexes[0])

  for (const straySegmentsGroup of straySegmentsGroups) {
    const nextTranscriptSegmentIndex = last(straySegmentsGroup.transcriptSegmentIndexes) + 1
    // TODO: stragglers at end? start?
    const matchWithChunks = itemsWithSubtitlesChunks.find((x) =>
      x.transcriptSegmentIndexes.includes(nextTranscriptSegmentIndex),
    )
    if (matchWithChunks) {
      matchWithChunks.transcriptSegmentIndexes = [
        ...straySegmentsGroup.transcriptSegmentIndexes,
        ...matchWithChunks.transcriptSegmentIndexes,
      ]
    }
  }
  return itemsWithSubtitlesChunks
}
