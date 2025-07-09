import { describe, it, expect } from 'vitest'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { findMatches } from './findMatches'
import { preprocessBaseTextSegments } from './preprocessBaseTextSegments'
import { parseSrtCues } from './srtHelpers'
import { isMatch } from './getRegionsByMatchStatus'

const defaultNormalize = (text: string): string =>
  text
    .replace(/[『「\s。？」、！』―]+/g, '')
    .trim()
    .toLowerCase()

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
    const ttsSegments = parseSrtCues(rashomonSrt).map((n, i) => ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
      normalizedText: defaultNormalize(typeof n.data === 'string' ? n.data : n.data.text),
    }))
    const results = findMatches({
      baseTextSubsegments: subsegments,
      baseTextSegments: segments,
      ttsSegments: ttsSegments,
      pass: '`',
      minMatchLength: 15,
      levenshteinThreshold: 2,
      baseTextSubsegmentsStartIndex: 0,
      baseTextSubsegmentsEnd: subsegments.length,
      ttsSegmentsStartIndex: 0,
      ttsSegmentsEnd: ttsSegments.length,
    })

    const matches = results.filter((r) => isMatch(r))

    expect(matches).length.greaterThan(10)
  })
})
