import { syncTranscriptWithSubtitles, getAnchorMatches, defaultOptions } from './syncTranscriptWithSubtitles'
import { analyzeTranscript } from './analyzeTranscript'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { parseSync } from 'subtitle'
import { describe, it, expect } from 'vitest'

const singleTranscriptSegmentInput = (text: string) => [{ text: rashomonOriginalText, translation: '', index: 0 }]

describe('analyzeTranscript', () => {
  it('returns faithful transcript segments', () => {
    const cues = analyzeTranscript(
      singleTranscriptSegmentInput(rashomonOriginalText),
      defaultOptions.transcriptSegmenters,
    ).atoms

    expect(cues.map((c) => c.text).join('')).toEqual(rashomonOriginalText)
  })
})

describe('getAnchorMatches', () => {
  it('gets a reasonable number of matches', () => {
    const transcript = rashomonOriginalText
    const segments = singleTranscriptSegmentInput(transcript)
    const analyzedTranscript = analyzeTranscript(segments, defaultOptions.transcriptSegmenters)
    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    expect(chunks.length).toBeGreaterThan(10)
    const ex = getAnchorMatches(analyzedTranscript, chunks).matches

    expect(ex.length).toBeGreaterThan(10)
    expect(ex.length).toBeLessThan(chunks.length)
  })
})

describe('getCuesForTranscript', () => {
  const transcript = rashomonOriginalText
  const segmentsInput = singleTranscriptSegmentInput(transcript)
  const analyzedTranscript = analyzeTranscript(segmentsInput, defaultOptions.transcriptSegmenters)
  const chunks = parseSync(rashomonSrt).map((n, i) => ({
    text: typeof n.data === 'string' ? n.data : n.data.text,
    index: i,
  }))
  // TODO: check unmatched as well
  const { matches, unmatched } = syncTranscriptWithSubtitles(segmentsInput, chunks)

  const atomIndexes = matches
    .flatMap((m) => m.transcriptAtomIndexes)
    .map((i) => analyzedTranscript.atomAt(i).absoluteIndex)
  const chunkIndexes = matches.flatMap((m) => m.subtitlesChunkIndexes)

  it('has no repeat/out of order segment indexes', () => {
    expect(atomIndexes).toEqual([...new Set(atomIndexes)])
  })

  it('has no repeat/out of order chunk indexes', () => {
    expect(chunkIndexes).toEqual([...new Set(chunkIndexes)])
  })

  it('includes all sub chunks', () => {
    expect(
      [...matches.flatMap((m) => m.subtitlesChunkIndexes), ...unmatched.flatMap((m) => m.subtitlesChunkIndexes)].sort(
        (a, b) => a - b,
      ),
    ).toEqual(parseSync(rashomonSrt).map((s, i) => i))
  })

  it('includes all text between segments/atoms', () => {
    const segments = singleTranscriptSegmentInput(transcript)
    // const analyzedTranscript = analyzeTranscript(segments)
    const actual = [
      ...matches.flatMap((m) => m.transcriptAtomIndexes),
      ...unmatched.flatMap((m) => m.transcriptAtomIndexes),
    ]
      .sort((a, b) => {
        return analyzedTranscript.atomAt(a).absoluteIndex - analyzedTranscript.atomAt(b).absoluteIndex
      })
      .map((i) => analyzedTranscript.atomAt(i).text)
      .join('')

    expect(actual).toEqual(segments.map((s) => s.text).join(''))
  })

  it('includes all text between atoms/transcript', () => {
    const transcriptionText = rashomonOriginalText
    const textFromAtoms = analyzedTranscript.atoms.map((a) => a.text).join('')
    expect(textFromAtoms).toEqual(transcriptionText)
  })
})
