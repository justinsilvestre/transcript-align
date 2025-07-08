import { BaseTextSegment, BaseTextSubsegment } from './syncTranscriptWithSubtitles'

export function preprocessBaseTextSegments(
  baseTextSegments: BaseTextSegment[],
  baseTextSubsegmenter: RegExp,
  normalizeBaseTextSubsegment: (text: string) => string,
): BaseTextSubsegment[] {
  let subsegmentIndex = 0
  return baseTextSegments.flatMap((segment): BaseTextSubsegment[] => {
    if (!segment.text)
      return [
        {
          segmentIndex: segment.index,
          indexInSource: 0,
          subsegmentIndex: subsegmentIndex++,
          text: '',
          normalizedText: '',
        },
      ]

    const subsegments = segment.text.match(baseTextSubsegmenter)
    if (!subsegments) throw new Error(`No matches found for segment: ${segment.text}`)
    return subsegments.map((text, index) => ({
      segmentIndex: segment.index,
      indexInSource: index,
      subsegmentIndex: subsegmentIndex++,
      text,
      normalizedText: normalizeBaseTextSubsegment(text),
    }))
  })
}
