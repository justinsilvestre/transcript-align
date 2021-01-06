import { SearchResolutionItem, SubtitlesChunk } from './syncTranscriptWithSubtitles'
import { AnalyzedTranscript } from './analyzeTranscript'

export default function logMatchesResult(
  matches: SearchResolutionItem[],
  transcript: AnalyzedTranscript,
  chunks: SubtitlesChunk[],
) {
  const toLog = matches
    .map(
      (matchOrDeadEnd) =>
        (matchOrDeadEnd.type === 'SearchDeadEnd' ? matchOrDeadEnd.reason : matchOrDeadEnd.type) +
        ' ' +
        matchOrDeadEnd.params +
        '    subs: ' +
        matchOrDeadEnd.items.subtitlesChunkIndexes.map((ci) => '--' + chunks[ci].text).join('\n    ') +
        '\n    trscpt: ' +
        matchOrDeadEnd.items.transcriptAtomIndexes
          .map((ai) => '-- s' + transcript.atoms[ai].segmentIndex + ' ' + transcript.atoms[ai].text)
          .join('\n    ') +
        '\n',
    )

  console.log(toLog.join('\n'))
}
