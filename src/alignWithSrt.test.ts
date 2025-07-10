import { describe, it, expect } from 'vitest'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { alignWithSrt } from './alignWithSrt'
import { isMatch } from './getRegionsByMatchStatus'
import { BaseTextSubsegmentsMatchResult } from './syncTranscriptWithSubtitles'
import { parseSrtCues } from './srtHelpers'
import { isLevenshteinImprovement } from './isLevenshteinImprovement'

// TODO:
// make sure that "この髪を抜いてな" repetition is handled correctly (see generated HTML preview)

describe('alignWithSrt', async () => {
  it('preserves all the subsegments from the transcript', async () => {
    const transcript = rashomonOriginalText
    const { results, baseTextSubsegments } = await alignWithSrt(transcript, rashomonSrt)
    const missingSubsegments = baseTextSubsegments.filter((subsegment) => {
      return !results.some((result) => {
        return isMatch(result)
          ? result.subsegments.start <= subsegment.subsegmentIndex &&
              result.subsegments.end > subsegment.subsegmentIndex
          : result.baseTextSubsegmentIndex === subsegment.subsegmentIndex
      })
    })
    expect(missingSubsegments.slice(0, 10)).toEqual([])
  })

  it('preserves all the TTS segments from the SRT in regions', async () => {
    const srtSegments = parseSrtCues(rashomonSrt)
    const transcript = rashomonOriginalText
    const { results, baseTextSubsegments, regions } = await alignWithSrt(transcript, rashomonSrt)
    const allSrtSegmentIndexes = new Set(
      regions.flatMap((region) => {
        return getArrayIndices(region.ttsSegments.start, region.ttsSegments.end)
      }),
    )
    const missingSrtSegments = srtSegments.filter((_, index) => {
      return !allSrtSegmentIndexes.has(index)
    })
    expect(missingSrtSegments.slice(0, 10)).toEqual([])
  })

  it('preserves all the text from the transcript in subsegments', async () => {
    const transcript = rashomonOriginalText
    const { baseTextSubsegments, getBaseTextSubsegmentText } = await alignWithSrt(transcript, rashomonSrt)
    const combinedTextSubsegmentsText = baseTextSubsegments
      .map((result) => {
        return getBaseTextSubsegmentText(result.subsegmentIndex)
      })
      .join('')

    expect(combinedTextSubsegmentsText).toEqual(transcript)
  })

  it('preserves all the text from the transcript in match results', async () => {
    const transcript = rashomonOriginalText
    const { results, getBaseTextSubsegmentText, getTtsSegmentText } = await alignWithSrt(transcript, rashomonSrt)

    const combinedText = results
      .map((result) => {
        return retrieveSubsegmentMatchResultText(result, getBaseTextSubsegmentText)
      })
      .join('')

    expect(combinedText).toEqual(transcript)
  })
})

function retrieveSubsegmentMatchResultText(
  result: BaseTextSubsegmentsMatchResult,
  getBaseTextSubsegmentText: (index: number) => string,
) {
  return isMatch(result)
    ? getArrayIndices(result.subsegments.start, result.subsegments.end)
        .map((i) => getBaseTextSubsegmentText(i))
        .join('')
    : getBaseTextSubsegmentText(result.baseTextSubsegmentIndex)
}

function getArrayIndices(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start)
}
