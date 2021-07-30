import { analyzeTranscript } from './analyzeTranscript'
import { getTsvSegmentsFromText } from './getTsvSegments'
import { rashomon } from './rashomon'
import { defaultTranscriptSegmenter } from './syncTranscriptWithSubtitles'

const segmenter = /[「\p{L}\p{N}]+([「\p{L}\p{N}]|[^\S\r\n]+)*([^「\p{L}\p{N}]+|$)/gu
const getSegments = (text: string) =>
  [...text.matchAll(segmenter)].map((text, index) => ({
    index,
    text: text[0],
    translation: '',
  }))
describe('analyzeTranscript', () => {
  it('returns faithful transcript segments', () => {
    const segments = analyzeTranscript(getSegments(rashomon), segmenter).segments

    expect(segments.map((c) => c.text.replace(/\s/g, '')).join('')).toEqual(rashomon.replace(/\s+/g, ''))
  })

  it('returns faithful transcript subsegments', () => {
    const atoms = analyzeTranscript(getSegments(rashomon), segmenter).atoms

    expect(atoms.map((c) => c.text.replace(/\s/g, '')).join('')).toEqual(rashomon.replace(/\s+/g, ''))
  })

  // TODO: test with miira segmented as in scripts/refineSrtWithTranscript.ts
})
