import { refineSrtWithTranscript } from './refineSrtWithTranscript'
import { rashomon, rashomonSrt } from './rashomon'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles2'
import { analyzeTranscript } from './analyzeTranscript'
import { parseSync } from 'subtitle'
import { readFileSync } from 'fs'
import * as path from 'path'

describe('refineSrtWithTranscript', () => {
  it('tmp', () => {
    const transcript = rashomon
    // const segments = getTranscriptSegments(transcript)
    const segments = readFileSync(path.join(__dirname, 'rashomonAlignedImperfect.tsv'), 'utf8')
      .split('\n')
      .filter((s) => s.trim())
      .map((line, index) => {
        const [text, translation] = line.split('\t')
        // console.log({ text, translation })
        return {
          text,
          translation,
          index,
        }
      })

    const chunks = parseSync(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))

    const synced = syncTranscriptWithSubtitles(segments, chunks)

    const refined = refineSrtWithTranscript(rashomonSrt, synced)

    // const indexes = refined.flatMap((r) => r.transcriptAtomIndexes.map((i) => i[0]))
    // console.log({
    //   refined: [...new Set(indexes)].map((i) => ({
    //     seg: synced.analyzedTranscript.segments[i].text,
    //     tr: synced.analyzedTranscript.segments[i].translation,
    //   })),
    // })

    expect(
      refined
      // .groupedBySegment
      //   // .flatMap((item) => item.resolved.flatMap(i => i.items.transcriptAtomIndexes).map((i) => synced.analyzedTranscript.atoms[i].text))
      //   .flatMap((item) => item.text).join('')
      .srtBlocks.map(s => s.data.text).join('')
        ,
    ).toEqual(segments.map(s => s.text).join(''))
  })
})
