import * as fs from 'fs'
import { stringifySync } from 'subtitle'
import yargs from 'yargs'
import { refineSrtFileWithTranscript } from '../refineSrtWithTranscript'
// @ts-ignore
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv)).argv

type Args = {
  s: string
  t: string
  o: string
}

const { s: srtPath, t: transcriptPath, o: outputPath } = (argv as any) as Args

console.log('refining...')

if (srtPath && transcriptPath) {
  if (outputPath && fs.existsSync(outputPath)) throw new Error('Path already taken: ' + outputPath)

  const result = refineSrtFileWithTranscript(srtPath, transcriptPath)
  const newSrtText = stringifySync(
    result.srtCues.map((c, index) => ({ ...c, index })),
    { format: 'SRT' },
  )

  console.log('writing to', outputPath)

  if (!outputPath) console.log(newSrtText)

  fs.writeFileSync(outputPath, newSrtText, 'utf-8')
} else {
  console.log('please provide correct arguments!')
}
