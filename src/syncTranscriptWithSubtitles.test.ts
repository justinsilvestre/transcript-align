import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { parseSync } from 'subtitle'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import {
  BaseTextSubsegmentMatchResult,
  findMatches,
  getRegionsByMatchStatus,
  preprocessBaseTextSegments,
  syncTranscriptWithSubtitles,
} from './syncTranscriptWithSubtitles'
import { writeFileSync } from 'fs'

const singleTranscriptSegmentInput = (text: string) => [{ text, normalizedText: defaultNormalize(text), index: 0 }]

const tmpFolder = path.join(__dirname, '../tmp')
if (!fs.existsSync(tmpFolder)) {
  fs.mkdirSync(tmpFolder, { recursive: true })
}
const htmlPreviewOutputPath = path.join(tmpFolder, 'preview.html')

const defaultNormalize = (text: string): string =>
  text
    .replace(/[『「\s。？」、！』―]+/g, '')
    .trim()
    .toLowerCase()
describe('findMatches', () => {
  it('gets a reasonable number of matches for first pass', () => {
    const transcript = rashomonOriginalText
    const segments = singleTranscriptSegmentInput(transcript)
    const subsegments = preprocessBaseTextSegments(
      segments,
      /[^\s。？、！―]+[\s。？、！―]+[」』]*|[^\s。？」、！』―]+[\s。？、！―」』]*$/gu,
      defaultNormalize,
    )
    const ttsSegments = parseSync(rashomonSrt).map((n, i) => ({
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

describe('syncTranscriptWithSubtitles', () => {
  it('syncs transcript with subtitles', () => {
    const transcript = rashomonOriginalText
    const { results, getBaseTextSubsegmentText, getTtsSegmentText } = syncTranscriptWithSubtitles({
      baseTextSegments: singleTranscriptSegmentInput(transcript),
      ttsSegments: parseSync(rashomonSrt).map((n, i) => ({
        text: typeof n.data === 'string' ? n.data : n.data.text,
        index: i,
        normalizedText: defaultNormalize(typeof n.data === 'string' ? n.data : n.data.text),
      })),
      baseTextSubsegmenter: /[^\s。？、！―]+[\s。？、！―]+[」』]*|[^\s。？」、！』―]+[\s。？、！―」』]*$/gu,
    })

    const htmlPreview = getHtmlPreview(results, getBaseTextSubsegmentText, getTtsSegmentText)
    writeFileSync(htmlPreviewOutputPath, htmlPreview, 'utf-8')
  })
})

function getHtmlPreview(
  results: BaseTextSubsegmentMatchResult[],
  getBaseTextSubsegmentText: (sourceIndex: number, index: number) => string,
  getTtsSegmentText: (index: number) => string,
) {
  // bolder green for higher confidence matches i.e. lower levenshtein threshold
  // from 2 to 10
  const getHighlightColor = (match: BaseTextSubsegmentMatchResult) => {
    if (match.ttsSegmentIndex == null) return '#f0f0f0' // no highlight for unmatched segments
    const levenshteinThreshold = match.matchParameters.levenshteinThreshold
    if (levenshteinThreshold <= 1) return '#e8fbe8' // very light green for close matches
    if (levenshteinThreshold <= 2) return '#d0f0d0' // light green for less close matches
    if (levenshteinThreshold <= 3) return '#c0e0c0' // medium green for even less close matches
    if (levenshteinThreshold <= 4) return '#b0d0b0' // darker green for more distant matches
    if (levenshteinThreshold <= 5) return '#a0c0a0' // even darker green for very distant matches
    if (levenshteinThreshold > 6) {
      // if levenshtein threshold is very high
      return '#f0f0f0' // default gray for less close matches
    }
  }

  const regions = getRegionsByMatchStatus({ results, getBaseTextSubsegmentText, getTtsSegmentText })

  const mainContent = regions
    .map((region) => {
      if (!region.isMatching) {
        const ttsSegments = getArrayIndices(region.ttsSegments.start, region.ttsSegments.end).map((i) => {
          return getTtsSegmentText(i)
        })
        return `<div style="display: flex; background-color:rgb(224, 224, 224); gap: 20px; padding: 4px; margin: 5px;">
          <div style="flex: 1; padding: 4px; background-color: #f0f0f0;">
            ${region.results
              .map((r) => getBaseTextSubsegmentText(r.baseTextSegmentIndex, r.baseTextSubsegmentIndex))
              .join('<br>')}
          </div>
          <div style="flex: 1; padding: 4px; background-color: #f0f0f0;">
            ${ttsSegments.join('<br>')}
          </div>
        </div>`
      }

      return region.results
        .map((r) => {
          const ttsSegmentText = r.ttsSegmentIndex == null ? null : getTtsSegmentText(r.ttsSegmentIndex)
          const baseTextSubsegmentText = getBaseTextSubsegmentText(r.baseTextSegmentIndex, r.baseTextSubsegmentIndex)

          return `<div style="background-color: ${getHighlightColor(
            r,
          )}; padding: 10px; margin: 5px;">${baseTextSubsegmentText} <span style="color: #007bff;">${ttsSegmentText}</span>
          <div style="color: green; height: 0.3em">${Array(r.matchParameters.minMatchLength)
            .fill('•')
            .join('&nbsp;&nbsp;&nbsp;')}</div>
        </div>`
        })
        .join('')
    })
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript Matches Preview</title>
</head>
<body>
  ${mainContent}
</body>
</html>`
}

function getArrayIndices(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start)
}
