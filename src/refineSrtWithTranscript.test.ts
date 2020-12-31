import { refineSrtWithTranscript } from "./refineSrtWithTranscript";
import { rashomon, rashomonSrt } from './rashomon'
import { syncTranscriptWithSubtitles } from "./syncTranscriptWithSubtitles";
import { analyzeTranscript } from "./analyzeTranscript";
import { parseSync } from "subtitle";
import { readFileSync } from 'fs'
import * as path from 'path'

describe('refineSrtWithTranscript', () => {
  it('tmp', () => {
    const transcript = rashomon
    // const segments = getTranscriptSegments(transcript)
    const segments = readFileSync(path.join(__dirname, 'rashomonAlignedImperfect.tsv'), 'utf8').split('\n').filter(s => s.trim())
    .map((line, index) => {
      const [text, translation] = line.split('\t')
      console.log({ text, translation })
      return ({
        text, translation, index
      });
    })

    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))
    
    const synced = syncTranscriptWithSubtitles(segments, chunks)

    const refined = refineSrtWithTranscript(rashomonSrt, synced)


    
    expect(refined.flatMap(item => item.transcriptAtomIndexes.map(i => synced.analyzedTranscript.atomAt(i).text))
    .join('')).toEqual(transcript)
    
  })
})