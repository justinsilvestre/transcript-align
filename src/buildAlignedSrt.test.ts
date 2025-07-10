import { beforeAll, describe, expect, it } from 'vitest'
import { buildAlignedSrt } from './buildAlignedSrt'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { AlignmentResult, alignWithSrt } from './alignWithSrt'
import { formatCueTime, parseSrtCues } from './srtHelpers'

describe('buildAlignedSrt', () => {
  let newSrtText: string
  let alignment: AlignmentResult

  beforeAll(async () => {
    const baseText = rashomonOriginalText
    const srtText = rashomonSrt
    alignment = await alignWithSrt(baseText, srtText)

    newSrtText = buildAlignedSrt({
      ...alignment,
      srtText,
    })
  })

  it('should preserve the original SRT cues timings except when combined', () => {
    const originalCues = parseSrtCues(rashomonSrt)
    const newCues = parseSrtCues(newSrtText)

    const cuesRanges = alignment.regions.flatMap((r) =>
      r.isMatching ? r.results.flatMap((result) => result.ttsSegments) : r.ttsSegments,
    )
    const timingsFromOldSrt = cuesRanges.map(({ start, end }) => ({
      start: originalCues[start].data.start,
      end: originalCues[end - 1].data.end,
    }))

    const newCuesNotInOriginal = newCues
      .flatMap((newCue) => {
        const noOverlap = !timingsFromOldSrt.some((old) => cuesOverlap(newCue.data, old))
        if (noOverlap)
          return [
            {
              data: newCue.data,
              timing: formatCueTime(newCue.data.start, newCue.data.end),
            },
          ]

        return []
      })
      .slice(0, 10)
    const originalCuesNotInNew = originalCues
      .filter(({ data: old }) => !newCues.some((newCue) => cuesOverlap(newCue.data, old)))
      .map((cue) => ({
        data: cue.data,
        timing: formatCueTime(cue.data.start, cue.data.end),
      }))
      .slice(0, 10)

    expect({
      newCuesNotInOriginal,
      originalCuesNotInNew,
    }).toEqual({
      newCuesNotInOriginal: [],
      originalCuesNotInNew: [],
    })
  })

  it('preserves the original base text', () => {
    const originalText = rashomonOriginalText
    const newCues = parseSrtCues(newSrtText, { preserveTrailingNewlines: true })
    const newCuesText = newCues.map((cue) => cue.data.text)

    expect(newCuesText.join('')).toEqual(originalText)
  })
})

function cuesOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && a.end > b.start
}
