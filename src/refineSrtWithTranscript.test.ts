import { refineSrtWithTranscript } from './refineSrtWithTranscript'
import { rashomon, rashomonSrt } from './rashomon'
import { syncTranscriptWithSubtitles } from './syncTranscriptWithSubtitles'
import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import logMatchesResult from './logMatchesResult'
import { getTsvSegments, parseSrt } from './getTsvSegments'
import { stringifySync } from 'subtitle'

describe('refineSrtWithTranscript', () => {
  function testJwTl() {
    it('tagalog', () => {
      const segments = getTsvSegments(path.join(__dirname, '..', 'lfb_tg.tsv'))
      const tgSrt = readFileSync(
        path.join(__dirname, '..', 'Lessons You Can Learn from the Bible - Tagalog.srt'),
        'utf8',
      )
      const chunks = parseSrt(tgSrt)
      const synced = syncTranscriptWithSubtitles(segments, chunks)
      const refined = refineSrtWithTranscript(tgSrt, synced)
      // const { newSrtText, translationSrtText } = refined

      logMatchesResult(synced.matches, synced.analyzedTranscript, chunks)

      // writeFileSync(__dirname + '/../out_tg.srt', newSrtText, 'utf8')
      // writeFileSync(__dirname + '/../out_tg_translation.srt', translationSrtText, 'utf8')
    })
  }

  it('tmp', () => {
    const transcript = rashomon
    // const segments = getTranscriptSegments(transcript)
    const segments = getTsvSegments(path.join(__dirname, 'rashomonAlignedImperfect.tsv'))
    const chunks = parseSrt(rashomonSrt)

    const synced = syncTranscriptWithSubtitles(segments, chunks)
    const refined = refineSrtWithTranscript(rashomonSrt, synced)

    // const indexes = refined.flatMap((r) => r.transcriptAtomIndexes.map((i) => i[0]))
    // console.log({
    //   refined: [...new Set(indexes)].map((i) => ({
    //     seg: synced.analyzedTranscript.segments[i].text,
    //     tr: synced.analyzedTranscript.segments[i].translation,
    //   })),
    // })

    const { srtCues, translationSrtCues } = refined
    const newSrtText = stringifySync(
      srtCues.map((c, index) => ({ ...c, index })),
      { format: 'SRT' },
    )
    const translationSrtText = stringifySync(
      translationSrtCues.map((c, index) => ({ ...c, index })),
      { format: 'SRT' },
    )

    function writeSrt() {
      console.log({ writingTo: __dirname + '../out.srt' })
      writeFileSync(__dirname + '/../out.srt', newSrtText, 'utf8')
      writeFileSync(__dirname + '/../out_translation.srt', translationSrtText, 'utf8')
    }

    expect(
      refined
      .srtCues
        .map((s) => s.data.text.replace(/\s+/g, ''))
        .join(''),
    ).toEqual(segments.map((s) => s.text.replace(/\s+/g, '')).join(''))

    // TODO: check translation text integrity
  })
})
