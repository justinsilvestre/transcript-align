import * as fs from 'fs'
import { parseSync, NodeCue, Cue } from 'subtitle'
import { analyzeTranscript, TranscriptSegment } from './analyzeTranscript'
import { getTsvSegmentsFromText } from './getTsvSegments'
import { last } from './last'
import { SyncResult, syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'

const LOGMISSNG = true

type MatchesGroupedByTranscriptSegments = { segments: TranscriptSegment[]; cues: Cue[] }

const segmenter = /[「\p{L}\p{N}]+([「\p{L}\p{N}]|[^\S\r\n]+)*([^「\p{L}\p{N}]+|$)/gu

export function refineSrtFileWithTranscript(srtFilePath: string, transcriptFilePath: string) {
  // TODO: fill in
  const srtText = fs.readFileSync(srtFilePath, 'utf-8')
  const transcriptText = fs.readFileSync(transcriptFilePath, 'utf-8')
  // const [...match] = transcriptText.matchAll(/[「\p{L}\p{N}]+([\p{L}\p{N}]|[^\S\r\n]+)*([^「\p{L}\p{N}]+|$)/gu) || []
  const [...match] = transcriptText.matchAll(segmenter) || []

  console.log(match.map((t) => t[0]))
  const transcriptSegments = match.map((text, index) => ({
    index,
    text: text[0],
    translation: '',
  }))

  // TODO: resolve "noTranscriptBit" issues

  const transcriptAnalysis = analyzeTranscript(transcriptSegments, segmenter)

  const srtChunks = parseSync(srtText).map((n, i) => ({
    text: typeof n.data === 'string' ? n.data : n.data.text,
    index: i,
  }))
  const synced = syncTranscriptWithSubtitles(transcriptAnalysis.segments, srtChunks)

  const unsyncedBits = synced.matches.filter((matchOrDeadEnd) => {
    if (matchOrDeadEnd.type === 'SearchDeadEnd') return true

    const atomIndex = matchOrDeadEnd.items.transcriptAtomIndexes[0]
    const allAtoms = synced.analyzedTranscript.atoms

    const atom = allAtoms[atomIndex]

    return !atom
  })
  console.log(
    'unsyncedBits',
    unsyncedBits.map((matchOrDeadEnd) => {
      return {
        ...matchOrDeadEnd,
        srtText: matchOrDeadEnd.items.subtitlesChunkIndexes.map((i) => srtChunks[i].text),
        transcriptText: matchOrDeadEnd.items.transcriptAtomIndexes.map((i) => transcriptAnalysis.atoms[i].text),
      }
    }),
  )

  const refined = refineSrtWithTranscript(srtText, synced)

  return refined
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

    if (LOGMISSNG && !atom) {
      // TODO: check this
      console.log({
        atomIndex,
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

  const srtCues = toSrtCues(groupedBySegment, ({ segments }) => segments.map((s) => s.text).join(''))
  const translationSrtCues = toSrtCues(groupedBySegment, ({ segments }) => segments.map((s) => s.translation).join(''))

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
