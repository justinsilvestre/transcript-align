import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import {
  analyzeTranscript,
  findMatches,
  getMatchSearchArea,
  syncTranscriptWithSubtitles,
} from './syncTranscriptWithSubtitles2'
import { rashomon, rashomonSrt } from './rashomon'
import { parseSync } from 'subtitle'
import { defaultOptions } from './syncTranscriptWithSubtitles'

const rashomonSegments = readFileSync(path.join(__dirname, 'rashomonAlignedImperfect.tsv'), 'utf8')
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
const rashomonChunks = parseSync(rashomonSrt).map((n, i) => ({
  text: typeof n.data === 'string' ? n.data : n.data.text,
  index: i,
}))

// describe('findMatches', () => {
//   const transcript = rashomon
//     // const analyzedTranscript = analyzeTranscript(segments, defaultOptions.transcriptSegmenters)

//   describe('with one pass', () => {
//     const analyzedTranscript = analyzeTranscript(rashomonSegments, defaultOptions.transcriptSegmenters)
//     const searchArea =  getMatchSearchArea(
//       rashomonChunks.map((c) => c.index),
//       analyzedTranscript.atoms.map((a) => a.absoluteIndex),
//     )

//     const result = findMatches(searchArea, 0, {
//       subtitlesChunks: rashomonChunks,
//       transcript: analyzedTranscript,
//       searchParamsProgression: [
//         [2, 15],
//       ]
//     })
//     // console.log(result)
//     // writeFileSync(process.cwd() + '/log', JSON.stringify(result, null, 2), 'utf8')

//     it('contains all sub chunks', () => {
//       const actual = result.flatMap(v => v.items.subtitlesChunkIndexes.flatMap(ci => rashomonChunks[ci].text))
//       const expected = rashomonChunks.map(c => c.text)

//       console.log(result.flatMap(v => v.type2 + ' ' + v.params + ' ' + v.items.subtitlesChunkIndexes.map(ci => rashomonChunks[ci].text).join(' ') + '\n'))

//       expect(actual).toEqual(expected)
//     })

//     it('contains all transcript atoms', () => {
//       const actual = result.flatMap(v => v.items.transcriptAtomIndexes.flatMap(ci => analyzedTranscript.atoms[ci].text))
//       const expected = analyzedTranscript.atoms.map(c => c.text)

//       expect(actual).toEqual(expected)
//     })
//   })
// })

describe('syncTranscriptWithSubtitles2', () => {
  const result = syncTranscriptWithSubtitles(rashomonSegments, rashomonChunks)
  const { analyzedTranscript } = result

  it('contains all sub chunks', () => {
    const actual = result.searched.flatMap((v) =>
      v.items.subtitlesChunkIndexes.flatMap((ci) => rashomonChunks[ci].text),
    )
    const expected = rashomonChunks.map((c) => c.text)

    console.log(
      result.searched.flatMap(
        (searchResultItem) =>
          (searchResultItem.type === 'SearchDeadEnd' ? searchResultItem.reason : searchResultItem.type) +
          ' ' +
          searchResultItem.params +
          '    subs: ' +
          searchResultItem.items.subtitlesChunkIndexes.map((ci) => rashomonChunks[ci].text).join(' ') +
          '\n    trscpt: ' + 
          searchResultItem.items.transcriptAtomIndexes.map((ai) => analyzedTranscript.atoms[ai].text) +
          '\n',
      ),
    )

    expect(actual).toEqual(expected)
  })

  it('contains all transcript atoms', () => {
    const actual = result.searched.flatMap((v) =>
      v.items.transcriptAtomIndexes.flatMap((ci) => analyzedTranscript.atoms[ci].text),
    )
    const expected = analyzedTranscript.atoms.map((c) => c.text)

    expect(actual).toEqual(expected)
  })
})
