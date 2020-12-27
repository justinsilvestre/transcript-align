import { getCuesForTranscript, getProbableMatches, getTranscriptSegments } from './getCuesForTranscript'
import { miira, miiraSrt } from './miira'
import { parseSync } from 'subtitle'

describe('getTranscriptSegments', () => {
  it('returns faithful transcript segments', () => {
    const cues = getTranscriptSegments(miira)
    expect(cues.map((c) => miira.slice(c.start, c.end)).join('')).toEqual(miira)
  })
})

describe('getExtremelyProbableMatches', () => {
  it('gets a reasonable number of matches', () => {
    const transcript = miira
    const cues = getTranscriptSegments(transcript)
    const chunks = parseSync(miiraSrt).map((n) => ({ text: typeof n.data === 'string' ? n.data : n.data.text }))
    expect(chunks.length).toBeGreaterThan(10)
    const ex = getProbableMatches(cues, miira, chunks, 18, 2)

    expect(ex.length).toBeGreaterThan(10)
    expect(ex.length).toBeLessThan(chunks.length)

    // console.log(ex.map((({ transcriptSegmentIndex, subtitlesChunkIndex}) => ({
    //   t: transcript.slice(cues[transcriptSegmentIndex].start,  cues[transcriptSegmentIndex].end),
    //   s: chunks[subtitlesChunkIndex].text,
    // }))))
  })
})

describe('getCuesForTranscript', () => {
  it('temp', () => {
    const transcript = miira
    const chunks = parseSync(miiraSrt).map((n) => ({ text: typeof n.data === 'string' ? n.data : n.data.text }))
    getCuesForTranscript(transcript, chunks)
  })
})
