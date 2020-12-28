import { getCuesForTranscript, getAnchorMatches, getTranscriptSegments } from './getCuesForTranscript'
import { miira, miiraSrt } from './miira'
import { parseSync } from 'subtitle'

describe('getTranscriptSegments', () => {
  it('returns faithful transcript segments', () => {
    const cues = getTranscriptSegments(miira)
    expect(cues.map((c) => miira.slice(c.start, c.end)).join('')).toEqual(miira)
  })
})

describe('getAnchorMatches', () => {
  it('gets a reasonable number of matches', () => {
    const transcript = miira
    const cues = getTranscriptSegments(transcript)
    const chunks = parseSync(miiraSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    expect(chunks.length).toBeGreaterThan(10)
    const ex = getAnchorMatches(cues, miira, chunks).matches

    expect(ex.length).toBeGreaterThan(10)
    expect(ex.length).toBeLessThan(chunks.length)
  })
})

describe('getCuesForTranscript', () => {
  it('has no repeat indexes', () => {
    const transcript = miira
    const chunks = parseSync(miiraSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    const { matches } = getCuesForTranscript(transcript, chunks)

    const segments = matches.flatMap((m) => m.transcriptSegmentIndexes)
    const chunksIndexes = matches.flatMap((m) => m.subtitlesChunkIndexes)

    expect({ segments, chunks: chunksIndexes }).toEqual({
      segments: [...new Set(segments)],
      chunks: [...new Set(chunksIndexes)],
    })
  })
})
