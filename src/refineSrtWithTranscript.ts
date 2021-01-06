import { parseSync, NodeCue, Cue } from 'subtitle'
import { TranscriptSegment } from './analyzeTranscript'
import { last } from './last'
import { SyncResult } from './syncTranscriptWithSubtitles'

type MatchesGroupedByTranscriptSegments = { segments: TranscriptSegment[]; cues: Cue[] }

export function refineSrtFileWithTranscript(srtFilePath: string, transcriptFilePath: string) {
  // TODO: fill in
}

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

  const groupedBySegment: MatchesGroupedByTranscriptSegments[] = []
  for (const matchOrDeadEnd of synced.matches) {
    const lastItem = last(groupedBySegment)
    const lastSegments = lastItem && lastItem.segments

    const atomIndex = matchOrDeadEnd.items.transcriptAtomIndexes[0]
    const atom = allAtoms[atomIndex]

    if (!atom) {
      // TODO: check this
      console.log({
        noTranscriptBit: matchOrDeadEnd,
        subchunktext: matchOrDeadEnd.items.subtitlesChunkIndexes.map((i) => chunks[i].text),
      })
      continue
    }

    const segments = [...new Set(matchOrDeadEnd.items.transcriptAtomIndexes.map((ai) => allAtoms[ai].segment))]

    const newCues = matchOrDeadEnd.items.subtitlesChunkIndexes.map((i) => chunks[i].data)
    // maybe there should really always be cues? but needed this check for jw hiligaynon
    const noNewCues = !newCues.length
    if (
      lastSegments != null &&
      ((lastSegments.length && lastSegments.some((ls) => segments.includes(ls))) || noNewCues)
    ) {
      lastItem.segments.push(...segments.filter((s) => !lastSegments.includes(s)))
      lastItem.cues.push(...newCues)
    } else
      groupedBySegment.push({
        segments,
        cues: newCues,
      })
  }

  const srtCues = toSrtCues(groupedBySegment, ({ segments }) => segments.map((s) => s.text).join('\n'))
  const translationSrtCues = toSrtCues(groupedBySegment, ({ segments }) =>
    segments.map((s) => s.translation).join('\n'),
  )

  return {
    groupedBySegment,
    srtCues,
    translationSrtCues,
  }
}

function toSrtCues(
  bySegment: MatchesGroupedByTranscriptSegments[],
  getText: (segmentMatches: MatchesGroupedByTranscriptSegments) => string,
): NodeCue[] {
  return bySegment.flatMap((segmentMatches) => {
    const { cues } = segmentMatches
    const text = getText(segmentMatches)

    const firstChunk = cues[0]
    const lastChunk = last(cues)
    if (!firstChunk || !lastChunk) {
      console.log({ firstChunk, lastChunk })
      const chunk = firstChunk || lastChunk

      if (!chunk) {
        console.error('match group missing subtitle chunks!')
        console.log('match group missing subtitle chunks!', segmentMatches)
        return [] // TODO: accommodate chunk-less initial searchgroup
      }

      return [
        {
          type: 'cue',
          data: {
            start: chunk.start,
            end: chunk.end,
            text,
          },
        },
      ]
    }
    return {
      type: 'cue',
      data: {
        start: firstChunk.start,
        end: lastChunk.end,
        text,
      },
    }
  })
}
