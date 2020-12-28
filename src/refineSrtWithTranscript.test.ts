import { refineSrtWithTranscript } from "./refineSrtWithTranscript";
import { rashomon, rashomonSrt } from './rashomon'
import { getTranscriptSegments } from "./getCuesForTranscript";
import { parseSync } from "subtitle";

describe('refineSrtWithTranscript', () => {
  it('tmp', () => {
    const transcript = rashomon
    const cues = getTranscriptSegments(transcript)
    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    
    const x = refineSrtWithTranscript(rashomonSrt, rashomon)
    expect(x.flatMap(y => y.transcriptSegmentIndexes.map(i => rashomon.slice(cues[i].start, cues[i].end)))
    .join('')).toEqual(transcript)
  })
})