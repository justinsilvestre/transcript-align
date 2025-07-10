import { NormalizeTextFunction } from './NormalizeTextFunction'
import { BaseTextSegment, BaseTextSubsegment } from './syncTranscriptWithSubtitles'

export async function preprocessBaseTextSegments(
  baseTextSegments: BaseTextSegment[],
  baseTextSubsegmenter: RegExp,
  normalizeBaseTextSubsegment: NormalizeTextFunction,
): Promise<BaseTextSubsegment[]> {
  let subsegmentIndex = 0
  const result: BaseTextSubsegment[] = []
  for (const segment of baseTextSegments) {
    if (!segment.text) {
      result.push({
        segmentIndex: segment.index,
        indexInSource: 0,
        subsegmentIndex: subsegmentIndex++,
        text: '',
        normalizedText: '',
      })
      continue
    }

    const subsegments = segment.text.match(baseTextSubsegmenter)
    if (!subsegments) throw new Error(`No matches found for segment: ${segment.text}`)

    for (let index = 0; index < subsegments.length; index++) {
      const text = subsegments[index]
      const normalizedText = await normalizeBaseTextSubsegment(text)
      result.push({
        segmentIndex: segment.index,
        indexInSource: index,
        subsegmentIndex: subsegmentIndex++,
        text,
        normalizedText,
      })
    }
  }
  return result
}
