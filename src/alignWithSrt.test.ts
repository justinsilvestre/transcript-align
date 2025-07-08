import { describe, it } from 'vitest'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { alignWithSrt } from './alignWithSrt'

// TODO:
// make sure that "この髪を抜いてな" repetition is handled correctly (see generated HTML preview)

describe('alignWithSrt', () => {
  it('syncs transcript with srt subtitles', () => {
    const transcript = rashomonOriginalText
    const { results, getBaseTextSubsegmentText, getTtsSegmentText } = alignWithSrt(transcript, rashomonSrt)
  })
})
