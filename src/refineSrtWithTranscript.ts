import * as fs from 'fs'
import { parseSync, stringifySync, NodeCue, NodeList, Node } from 'subtitle'
import { findIndexBetween } from './findIndexBetween'
import {
  syncTranscriptWithSubtitles,
  SegmentChunkMatch,
  Unmatched,
  SyncedTranscriptAndSubtitles,
} from './syncTranscriptWithSubtitles'
import { last } from './last'
import { rashomon } from './rashomon'
import { TranscriptSegment } from './analyzeTranscript'

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

  const newSrtNodes: { node: Node; segment: TranscriptSegment | null }[] = withoutStraySegments.map((x) => ({
    node: {
      type: 'cue',
      data: {
        start: chunks[x.subtitlesChunkIndexes[0]].data.start,
        end: chunks[last(x.subtitlesChunkIndexes)].data.end,
        text: x.transcriptAtomIndexes.map((i) => synced.analyzedTranscript.atomAt(i).text).join(''),
      },
    },
    segment: x.transcriptAtomIndexes.length
      ? synced.analyzedTranscript.atomAt(x.transcriptAtomIndexes[0]).segment
      : null,
  }))
  const newSrtText = stringifySync(
    newSrtNodes.map((n) => n.node),
    { format: 'SRT' },
  )

  // const segmentsToNodes = new Map<TranscriptSegment | null, Node[]>(newSrtNodes.map((n) => [n.segment, [n.node]]))
  const segmentsToNodes = newSrtNodes.reduce((acc, n) => {
    const key = n.segment
    if (!acc.has(key)) {
      acc.set(key, [])
    }
    acc.get(key)!.push(n.node)
    return acc
  }, new Map<TranscriptSegment | null, Node[]>())

  const translationSrtText = stringifySync(
    Array.from(segmentsToNodes, ([segment, nodes]) => ({
      type: 'cue',
      data: {
        start: (nodes[0].data as { start: number }).start,
        end: (last(nodes).data as { end: number }).end,
        text: segment?.translation || ' ',
      },
    })),

    { format: 'SRT' },
  )

  console.log({ writingTo: __dirname + '../out.srt' })
  fs.writeFileSync(__dirname + '/../out.srt', newSrtText, 'utf8')
  fs.writeFileSync(__dirname + '/../out_translation.srt', translationSrtText, 'utf8')

  return withoutStraySegments
}

function attachStraySegments(synced: SyncedTranscriptAndSubtitles) {
  const { matches, unmatched, analyzedTranscript } = synced
  const itemsWithSubtitlesChunks: Array<SegmentChunkMatch | Unmatched> = [
    ...matches.filter((m) => m.subtitlesChunkIndexes.length),
    ...unmatched.filter((m) => m.subtitlesChunkIndexes.length),
  ].sort((a, b) => a.subtitlesChunkIndexes[0] - b.subtitlesChunkIndexes[0])

  const straySegmentsGroups: Array<SegmentChunkMatch | Unmatched> = unmatched
    .filter((m) => !m.subtitlesChunkIndexes.length)
    .sort(
      (a, b) =>
        analyzedTranscript.toAbsoluteAtomIndex(a.transcriptAtomIndexes[0]) -
        analyzedTranscript.toAbsoluteAtomIndex(b.transcriptAtomIndexes[0]),
    )

  for (const straySegmentsGroup of straySegmentsGroups) {
    const nextTranscriptSegmentIndex =
      analyzedTranscript.toAbsoluteAtomIndex(last(straySegmentsGroup.transcriptAtomIndexes)) + 1
    // TODO: stragglers at end? start?
    const matchWithChunks = itemsWithSubtitlesChunks.find((x) =>
      x.transcriptAtomIndexes.some((i) => analyzedTranscript.toAbsoluteAtomIndex(i) === nextTranscriptSegmentIndex),
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
