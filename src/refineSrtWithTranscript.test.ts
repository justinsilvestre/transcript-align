import { refineSrtWithTranscript } from './refineSrtWithTranscript'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'
import { parseSync } from 'subtitle'
import { readFileSync, writeFile, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, it, expect } from 'vitest'

describe('refineSrtWithTranscript', () => {
  it('tmp', () => {
    const transcriptSegments = readFileSync(join(__dirname, 'testData', 'rashomonAlignedImperfect.tsv'), 'utf8')
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
    const transcript = rashomonOriginalText
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

    const splitTrascriptPath = join(__dirname, 'split.txt')
    writeFileSync(
      splitTrascriptPath,
      transcript
        .split(/([^\n。」]+[。\n」]+)/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n'),
      'utf8',
    )

    const atomsPath = join(__dirname, 'atoms.txt')
    writeFileSync(atomsPath, synced.analyzedTranscript.atoms.map((a) => a.text).join('\n'), 'utf8')

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
