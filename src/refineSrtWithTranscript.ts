import * as fs from 'fs'
import { parseSync, stringifySync, NodeCue, NodeList } from 'subtitle'
import { TranscriptSegment } from './analyzeTranscript'
import { last } from './last'
import { SearchResolutionItem, SyncResult } from './syncTranscriptWithSubtitles2'

// const transcriptSegments = getCuesForTranscript(transcript, chunks)

export function refineSrtWithTranscript(srtText: string, synced: SyncResult) {
  // TODO: get rid of any overlaps
  const chunks = parseSync(srtText)
    .filter((x): x is NodeCue => x.type === 'cue')
    .map((n, i) => ({
      text: n.data.text,
      index: i,
      data: n.data,
    }))

  const allAtoms = synced.analyzedTranscript.atoms

  const groupedBySegment: { segment: TranscriptSegment; resolved: SearchResolutionItem[]; text: string }[] = []
  let textBbuffer
  for (const item of synced.searched) {
    const lastItem = last(groupedBySegment)
    const lastAtomIndex = lastItem && lastItem.resolved[0].items.transcriptAtomIndexes[0]
    const atomIndex = item.items.transcriptAtomIndexes[0]
    const atom = allAtoms[atomIndex]

    if (!atom) {
      console.log({ noTranscriptBit: item, subchunktext: item.items.subtitlesChunkIndexes.map((i) => chunks[i].text) })
      continue
    }

    const segment = atom.segment

    const newText = item.items.transcriptAtomIndexes.map((ai) => allAtoms[ai].text).join('')

    if (lastAtomIndex != null && allAtoms[lastAtomIndex].segment === segment) {
      lastItem.resolved.push(item)
      lastItem.text += newText
    } else
      groupedBySegment.push({
        segment,
        resolved: [item],
        text: newText,
      })
  }

  const srtBlocks: NodeCue[] = groupedBySegment.flatMap(({ segment, resolved, text }) => {
    const firstChunkIndex = resolved[0].items.subtitlesChunkIndexes[0]
    const firstChunk = chunks[firstChunkIndex]
    const lastChunkIndex = last(last(resolved).items.subtitlesChunkIndexes)
    const lastChunk = chunks[lastChunkIndex]
    if (!firstChunk || !lastChunk) {
      console.log({ firstChunk, lastChunk, firstChunkIndex, lastChunkIndex })
      const chunk = firstChunk || lastChunk
      return [
        {
          type: 'cue',
          data: {
            start: chunk.data.start,
            end: chunk.data.end,
            text: text,
          },
        },
      ]
    }
    return {
      type: 'cue',
      data: {
        start: firstChunk.data.start,
        end: lastChunk.data.end,
        // text: resolved.flatMap(r => r.items.transcriptAtomIndexes)
        //   .map((i) => synced.analyzedTranscript.atoms[i].text)
        //   .join(''),
        text,
      },
    }
  })

  const srtTranslationBlocks: NodeCue[] = groupedBySegment.flatMap(({ segment, resolved, text }) => {
    const firstChunkIndex = resolved[0].items.subtitlesChunkIndexes[0]
    const firstChunk = chunks[firstChunkIndex]
    const lastChunkIndex = last(last(resolved).items.subtitlesChunkIndexes)
    const lastChunk = chunks[lastChunkIndex]
    if (!firstChunk || !lastChunk) {
      console.log({ firstChunk, lastChunk, firstChunkIndex, lastChunkIndex })
      const chunk = firstChunk || lastChunk
      return [
        {
          type: 'cue',
          data: {
            start: chunk.data.start,
            end: chunk.data.end,
            text: segment.translation,
          },
        },
      ]
    }
    return {
      type: 'cue',
      data: {
        start: firstChunk.data.start,
        end: lastChunk.data.end,
        // text: resolved.flatMap(r => r.items.transcriptAtomIndexes)
        //   .map((i) => synced.analyzedTranscript.atoms[i].text)
        //   .join(''),
        text: segment.translation,
      },
    }
  })


  const newSrtText = stringifySync(srtBlocks, { format: 'SRT' })
  const translationSrtText = stringifySync(srtTranslationBlocks, { format: 'SRT' })
  // const translationSrtText =  stringifySync(
  //   withoutStraySegments.map((x) => ({
  //     type: 'cue',
  //     data: {
  //       start: chunks[x.subtitlesChunkIndexes[0]].data.start,
  //       end: chunks[last(x.subtitlesChunkIndexes)].data.end,
  //       text: x.transcriptAtomIndexes
  //         .map((i) => {
  //           // TODO: fill in
  //           return ''
  //           // synced.analyzedTranscript.atomAt(i).translation
  //         })
  //         .join(''),
  //     },
  //   })),
  //   { format: 'SRT' },
  // )

  console.log({ writingTo: __dirname + '../out.srt' })
  fs.writeFileSync(__dirname + '/../out.srt', newSrtText, 'utf8')
  fs.writeFileSync(__dirname + '/../out_translation.srt', translationSrtText, 'utf8')

  return {
    groupedBySegment,
    srtBlocks,
  }
}

// function attachStraySegments(synced: SyncedTranscriptAndSubtitles) {
//   const { matches, unmatched, analyzedTranscript } =synced
//   const itemsWithSubtitlesChunks: Array<SegmentChunkMatch | Unmatched> = [
//     ...matches.filter((m) => m.subtitlesChunkIndexes.length),
//     ...unmatched.filter((m) => m.subtitlesChunkIndexes.length),
//   ].sort((a, b) => a.subtitlesChunkIndexes[0] - b.subtitlesChunkIndexes[0])

//   const straySegmentsGroups: Array<SegmentChunkMatch | Unmatched> = unmatched
//     .filter((m) => !m.subtitlesChunkIndexes.length)
//     .sort((a, b) => analyzedTranscript.toAbsoluteAtomIndex(a.transcriptAtomIndexes[0]) - analyzedTranscript.toAbsoluteAtomIndex(b.transcriptAtomIndexes[0]))

//   for (const straySegmentsGroup of straySegmentsGroups) {
//     const nextTranscriptSegmentIndex = analyzedTranscript.toAbsoluteAtomIndex(last(straySegmentsGroup.transcriptAtomIndexes)) + 1
//     // TODO: stragglers at end? start?
//     const matchWithChunks = itemsWithSubtitlesChunks.find((x) =>
//       x.transcriptAtomIndexes.some(i => analyzedTranscript.toAbsoluteAtomIndex(i) === nextTranscriptSegmentIndex),
//     )
//     if (matchWithChunks) {
//       matchWithChunks.transcriptAtomIndexes = [
//         ...straySegmentsGroup.transcriptAtomIndexes,
//         ...matchWithChunks.transcriptAtomIndexes,
//       ]
//     }
//   }
//   return itemsWithSubtitlesChunks
// }
