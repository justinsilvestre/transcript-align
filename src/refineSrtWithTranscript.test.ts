import { refineSrtWithTranscript } from './refineSrtWithTranscript'
import { rashomon, rashomonSrt } from './rashomon'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'
import { parseSync } from 'subtitle'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

describe('refineSrtWithTranscript', () => {
  it('tmp', () => {
    const transcriptSegments = readFileSync(join(__dirname, 'rashomonAlignedImperfect.tsv'), 'utf8')
      .split('\n')
      .filter((s) => s.trim())
      .map((line, index) => {
        const [text, translation] = line.split('\t')
        return {
          text,
          translation,
          index,
        }
      })
    const transcript = rashomon
    const srtText = rashomonSrt
    const srtChunks = parseSync(srtText).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
    }))

    const synced = syncTranscriptWithSubtitles(transcriptSegments, srtChunks)

    const refined = refineSrtWithTranscript(srtText, synced)

    console.log(
      synced.unmatched
        .slice(-10)
        .map(
          (m) =>
            m.subtitlesChunkIndexes.map((i) => srtChunks[i].text).join('~~') +
            '     |     ' +
            m.transcriptAtomIndexes.map((i) => synced.analyzedTranscript.atomAt(i).text).join('~~'),
        ),
    )

    expect(
      refined
        .map((item) => item.transcriptAtomIndexes.map((i) => synced.analyzedTranscript.atomAt(i).text).join(''))
        .join('')
        .split(/([^\n。」]+[。\n」]+)/g)
        .map((s) => s.trim())
        .filter(Boolean),
    ).toEqual(
      transcript
        .split(/([^\n。」]+[。\n」]+)/g)
        .map((s) => s.trim())
        .filter(Boolean),
    )
  })
})
