import { analyzeTranscript } from "./analyzeTranscript"
import { getTsvSegmentsFromText } from "./getTsvSegments"
import { rashomon } from './rashomon'
import { defaultTranscriptSegmenter } from "./syncTranscriptWithSubtitles"

describe('analyzeTranscript', () => {
  it('returns faithful transcript segments', () => {
    const segments = analyzeTranscript(getTsvSegmentsFromText(rashomon), defaultTranscriptSegmenter)
      .segments

    expect(segments.map((c) => c.text).join('\n')).toEqual(rashomon)
  })

  it('returns faithful transcript subsegments', () => {
    const atoms = analyzeTranscript(getTsvSegmentsFromText(rashomon), defaultTranscriptSegmenter)
      .atoms

    expect(atoms.map((c) => c.text.replace(/\s/g, '')).join('')).toEqual(rashomon.replace(/\s+/g, ''))
  })
})
