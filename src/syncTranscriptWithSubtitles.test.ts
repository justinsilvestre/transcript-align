import { readFileSync } from 'fs'
import * as path from 'path'
import {
  analyzeTranscript,
  defaultTranscriptSegmenter,
  findMatches,
  getMatchSearchArea,
  syncTranscriptWithSubtitles,
} from './syncTranscriptWithSubtitles'
import { rashomonSrt } from './rashomon'
import { parseSync } from 'subtitle'

const rashomonSegments = readFileSync(path.join(__dirname, 'rashomonAlignedImperfect.tsv'), 'utf8')
  .split('\n')
  .filter((s) => s.trim())
  .map((line, index) => {
    const [text, translation] = line.split('\t')
    return {
      text,
      translation,
      index,
    }
  })
export const rashomonChunks = parseSync(rashomonSrt).map((n, i) => ({
  text: typeof n.data === 'string' ? n.data : n.data.text,
  index: i,
}))

describe('findMatches', () => {
  describe('with one pass', () => {
    const analyzedTranscript = analyzeTranscript(rashomonSegments, defaultTranscriptSegmenter)
    const searchArea = getMatchSearchArea(
      rashomonChunks.map((c) => c.index),
      analyzedTranscript.atoms.map((a) => a.absoluteIndex),
    )

    const result = findMatches(searchArea, 0, {
      subtitlesChunks: rashomonChunks,
      transcript: analyzedTranscript,
      searchParamsProgression: [[2, 15]],
    })

    it('contains all sub chunks', () => {
      const actual = result.flatMap((v) => v.items.subtitlesChunkIndexes.flatMap((ci) => rashomonChunks[ci].text))
      const expected = rashomonChunks.map((c) => c.text)

      expect(actual).toEqual(expected)
    })

    it('contains all transcript atoms', () => {
      const actual = result.flatMap((v) =>
        v.items.transcriptAtomIndexes.flatMap((ci) => analyzedTranscript.atoms[ci].text),
      )
      const expected = analyzedTranscript.atoms.map((c) => c.text)

      expect(actual).toEqual(expected)
    })
  })
})

describe('syncTranscriptWithSubtitles', () => {
  const result = syncTranscriptWithSubtitles(rashomonSegments, rashomonChunks)
  const { analyzedTranscript, matches } = result

  const atomIndexes = matches.flatMap((m) => m.items.transcriptAtomIndexes)
  const chunkIndexes = matches.flatMap((m) => m.items.subtitlesChunkIndexes)

  it('has no repeat/out of order segment indexes', () => {
    expect(atomIndexes).toEqual([...new Set(atomIndexes)])
  })

  it('has no repeat/out of order chunk indexes', () => {
    expect(chunkIndexes).toEqual([...new Set(chunkIndexes)])
  })

  it('contains all sub chunks', () => {
    const actual = result.matches.flatMap((v) => v.items.subtitlesChunkIndexes.flatMap((ci) => rashomonChunks[ci].text))
    const expected = rashomonChunks.map((c) => c.text)

    expect(actual).toEqual(expected)
  })

  it('contains all transcript atoms', () => {
    const actual = result.matches.flatMap((v) =>
      v.items.transcriptAtomIndexes.flatMap((ci) => analyzedTranscript.atoms[ci].text),
    )
    const expected = analyzedTranscript.atoms.map((c) => c.text)

    expect(actual).toEqual(expected)
  })
})
