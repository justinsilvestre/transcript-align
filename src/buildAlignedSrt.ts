import { NodeCue } from 'subtitle'
import { MatchStatusRegion } from './getRegionsByMatchStatus'
import { parseSrtCues, type Node, buildSrt } from './srtHelpers'
import { BaseTextSubsegment } from './syncTranscriptWithSubtitles'

export function buildAlignedSrt({
  regions,
  baseTextSubsegmentJoinChar = '',
  baseTextSubsegments,
  getBaseTextSubsegmentText,
  srtText,
}: {
  regions: MatchStatusRegion[]
  baseTextSubsegmentJoinChar?: string
  baseTextSubsegments: BaseTextSubsegment[]
  getBaseTextSubsegmentText: (index: number) => string
  srtText: string
}): string {
  const originalCues = parseSrtCues(srtText, {
    preserveTrailingNewlines: true,
  })
  const cues: NodeCue[] = []
  for (const region of regions) {
    if (region.isMatching) {
      const matchResults = region.results
      for (const matchResult of matchResults) {
        const matchBaseTextSubsegments = getElementsInRange(baseTextSubsegments, matchResult.subsegments)
        const newText = matchBaseTextSubsegments
          .map((e) => getBaseTextSubsegmentText(e.subsegmentIndex))
          .join(baseTextSubsegmentJoinChar)
        const correspondingCues = originalCues.slice(matchResult.ttsSegments.start, matchResult.ttsSegments.end)
        const firstCorrespondingCue = correspondingCues[0]
        const lastCorrespondingCue = correspondingCues[correspondingCues.length - 1]
        const startTime = firstCorrespondingCue.data.start
        const endTime = lastCorrespondingCue.data.end

        cues.push({
          type: 'cue',
          data: {
            start: startTime,
            end: endTime,
            text: newText,
          },
        })
      }
    } else {
      const regionBaseTextSubsegments = getElementsInRange(baseTextSubsegments, region.subsegments)
      const newText = regionBaseTextSubsegments
        .map((e) => getBaseTextSubsegmentText(e.subsegmentIndex))
        .join(baseTextSubsegmentJoinChar)
      const correspondingCues = originalCues.slice(region.ttsSegments.start, region.ttsSegments.end)
      const firstCorrespondingCue = correspondingCues[0]
      if (!firstCorrespondingCue) {
        const lastCue = cues[cues.length - 1]
        if (lastCue && newText) {
          lastCue.data.text = `${lastCue.data.text}${baseTextSubsegmentJoinChar}${newText}`
        }
        continue
      }
      const lastCorrespondingCue = correspondingCues[correspondingCues.length - 1]
      const startTime = firstCorrespondingCue.data.start
      const endTime = lastCorrespondingCue.data.end

      if (newText) {
        cues.push({
          type: 'cue',
          data: {
            start: startTime,
            end: endTime,
            text: newText,
          },
        })
      }
    }
  }

  return buildSrt(cues)
}

export function getElementsInRange<T>(array: T[], range: { start: number; end: number }): T[] {
  return array.slice(range.start, range.end)
}
