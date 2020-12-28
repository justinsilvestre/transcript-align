import { getCuesForTranscript, getAnchorMatches, getTranscriptSegments, SegmentChunkMatch, Unmatched } from './getCuesForTranscript'
import { rashomon, rashomonSrt } from './rashomon'
import { parseSync } from 'subtitle'
import { last } from './last'

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
  const transcript = rashomon
  const chunks = parseSync(rashomonSrt).map((n, i) => ({
    text: typeof n.data === 'string' ? n.data : n.data.text,
    index: i,
  }))
  // TODO: check unmatched as well
  const { matches, unmatched } = getCuesForTranscript(transcript, chunks)

  const segments = matches.flatMap((m) => m.transcriptSegmentIndexes)
  const chunksIndexes = matches.flatMap((m) => m.subtitlesChunkIndexes)

  it('has no repeat/out of order segment indexes', () => {
    expect(segments).toEqual([...new Set(segments)])
  })

  it('has no repeat/out of order chunk indexes', () => {
    expect(chunksIndexes).toEqual([...new Set(chunksIndexes)])
  })

  it('includes all sub chunks', () => {
    expect([
      ...matches.flatMap(m => m.subtitlesChunkIndexes),
      ...unmatched.flatMap(m => m.subtitlesChunkIndexes),
    ].sort((a,b) => a - b)).toEqual(parseSync(rashomonSrt).map((s, i) => i))
  })

  it('includes all text segments', () => {
    const segments = getTranscriptSegments(rashomon)
    expect([
      ...matches.flatMap(m => m.transcriptSegmentIndexes),
      ...unmatched.flatMap(m => m.transcriptSegmentIndexes),
    ].sort((a,b) => a - b).map(i => rashomon.slice(segments[i].start, segments[i].end)))
    .toEqual(segments.map((s, i) => rashomon.slice(segments[i].start, segments[i].end)))
  })
})
