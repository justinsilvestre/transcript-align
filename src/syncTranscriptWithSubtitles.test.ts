import { describe, it, expect } from 'vitest'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { findMatches, preprocessBaseTextSegments } from './syncTranscriptWithSubtitles'
import { defaultNormalize } from './alignWithSrt'
import { parseSrt } from './srtHelpers'

describe('findMatches', () => {
  it('gets a reasonable number of matches for first pass', () => {
    const transcript = rashomonOriginalText
    const segments = [
      {
        text: transcript,
        normalizedText: defaultNormalize(transcript),
        index: 0,
      },
    ]
    const subsegments = preprocessBaseTextSegments(
      segments,
      /[^\s。？、！―]+[\s。？、！―]+[」』]*|[^\s。？」、！』―]+[\s。？、！―」』]*$/gu,
      defaultNormalize,
    )
    const ttsSegments = parseSrt(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
      normalizedText: defaultNormalize(typeof n.data === 'string' ? n.data : n.data.text),
    }))
    const { results, getBaseTextSubsegmentText, getTtsSegmentText } = findMatches({
      baseTextSubsegments: subsegments,
      baseTextSegments: segments,
      ttsSegments: ttsSegments,
      passNumber: 1,
      minMatchLength: 15,
      levenshteinThreshold: 2,
      baseTextSubsegmentsStartIndex: 0,
      baseTextSubsegmentsEnd: subsegments.length,
      ttsSegmentsStartIndex: 0,
      ttsSegmentsEnd: ttsSegments.length,
    })

    const matches = results.filter((r) => r.ttsSegmentIndex == null)

    expect(matches).length.greaterThan(10)
  })
})
