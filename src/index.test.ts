import { getCuesForTranscript, getAnchorMatches, getTranscriptSegments } from './getCuesForTranscript'
import { rashomon, rashomonSrt } from './rashomon'
import { parseSync } from 'subtitle'

describe('getTranscriptSegments', () => {
  it('returns faithful transcript segments', () => {
    const cues = getTranscriptSegments(rashomon)
    expect(cues.map((c) => rashomon.slice(c.start, c.end)).join('')).toEqual(rashomon)
  })
})

describe('getAnchorMatches', () => {
  it('gets a reasonable number of matches', () => {
    const transcript = rashomon
    const cues = getTranscriptSegments(transcript)
    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    expect(chunks.length).toBeGreaterThan(10)
    const ex = getAnchorMatches(cues, rashomon, chunks).matches

    expect(ex.length).toBeGreaterThan(10)
    expect(ex.length).toBeLessThan(chunks.length)
  })
})

describe('getCuesForTranscript', () => {
  it('has no repeat/out of order indexes', () => {
    const transcript = rashomon
    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    // TODO: check unmatched as well
    const { matches } = getCuesForTranscript(transcript, chunks)

    const segments = matches.flatMap((m) => m.transcriptSegmentIndexes)
    const chunksIndexes = matches.flatMap((m) => m.subtitlesChunkIndexes)


    // expect({ segments, chunks: chunksIndexes }).toEqual({
    //   segments: [...new Set(segments)],
    //   chunks: [...new Set(chunksIndexes)],
    // })
    expect(segments).toEqual([...new Set(segments)])
    expect(chunksIndexes).toEqual([...new Set(chunksIndexes)])
  })
})
