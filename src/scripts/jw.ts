import { exec } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import yargs from 'yargs'
// @ts-ignore
import { hideBin } from 'yargs/helpers'
import { getDom } from '../jsdom'
import { lfbChapters, lfbContentFolderName, lfbImages } from '../jwData'
import { JSDOM } from 'jsdom'
import * as papa from 'papaparse'
import { getTsvSegmentsFromText, parseSrt } from '../getTsvSegments'
import { syncTranscriptWithSubtitles } from '../syncTranscriptWithSubtitles'
import { refineSrtWithTranscript } from '../refineSrtWithTranscript'
import logMatchesResult from '../logMatchesResult'
import { NodeCue, stringifySync } from 'subtitle'

type Section = {
  imagePath: string
  duration: number
  mp3Path: string
  getTsvText: () => Promise<string>
}

console.log(
  'usage:\n' +
    ` yarn jw \\
 --l1 tl \\
 --l2 en \\
 --m ~/Downloads/jw_work/Lessons\\ You\\ Can\\ Learn\\ from\\ the\\ Bible\\ -\\ Hiligaynon\\ lfb_HV.mp3.zip \\
 --e1 ~/Downloads/jw_work/Lessons\\ You\\ Can\\ Learn\\ from\\ the\\ Bible\\ -\\ Hiligaynon\\ lfb_HV.epub \\
 --e2 ~/Downloads/jw_work/Lessons\\ You\\ Can\\ Learn\\ from\\ the\\ Bible\\ -\\ English\\ lfb_E.epub \\
 --a ~/code/af-aligner/scripts/LF_aligner_3.12_with_modules.pl`,
)

// REMINDER: DON'T CONCAT AAC AUDIO.

// SLIDESHOW APPROACH: https://superuser.com/questions/1320296/ffmpeg-turning-images-audio-into-video-with-ffmpeg
// using concat demuxer to make images into video using durations https://trac.ffmpeg.org/wiki/Slideshow
// REPEAT LAST ONE LIKE IT SAYS!!

// forum post about doing what i am with the audio + images -> video?
// https://forum.videohelp.com/threads/391462-Need-Help-to-convert-mp3-to-mp4-using-mp3-s-album-art-pic-as-still-pic
// setlocal enabledelayedexpansion
// ::echo off
// for %%a in (*.mp3) Do (
// set /a count=0
// cd %%~dpa
// set /a Number=0
// ffmpeg.exe -i "%%a" -an -vcodec copy "%%~na_image.jpg"
// ffmpeg.exe -i "%%~na_image.jpg" -f image2 -vf scale=800:-1 "%%~na_image800.jpg"
// ffmpeg -loop 1 -f image2 -i "%%~na_image800.jpg"^
//  -i "%%a" -map 0:0 -map 1:0 -acodec copy -vcodec libx264 -r 30 -shortest  -pix_fmt yuv420p^
//  "%%~na_AudioVideo.MP4"
// set /a count+=1
// )
// echo !count! files converted
//
// pause

const argv = yargs(hideBin(process.argv)).argv

const execPromise = (command: string) => {
  log(`           $ ${command}`)
  return util.promisify(exec)(command)
}
type Args = {
  e1: string
  e2: string
  m: string
  l1: string
  l2: string
  a: string
}

const {
  e1: epubFilePath1,
  e2: epubFilePath2,
  m: mp3ZipFilePath,
  l1: autosubLangCode1,
  l2: autosubLangCode2,
  a: alignerExecutablePath,
} = (argv as any) as Args

const cwd = (...pathsFromCwd: string[]) => path.join(process.cwd(), 'output', ...pathsFromCwd)
const workspaceDirectoryPath = cwd(path.parse(epubFilePath1).name + `__${autosubLangCode1}_${autosubLangCode2}`)
const inWorkingDir = (...pathsFromWorkingDir: string[]) => path.join(workspaceDirectoryPath, ...pathsFromWorkingDir)

const vidOutputPath = cwd(`${path.parse(epubFilePath1).name}__${autosubLangCode1}.mp4`)
const bigAudioOutputPath = inWorkingDir(`${path.parse(epubFilePath1).name}__${autosubLangCode1}.aac`)

const extractedEpubPath1 = inWorkingDir(path.parse(epubFilePath1).name)
const extractedEpubPath2 = inWorkingDir(path.parse(epubFilePath2).name)

const combinedEpubContentPath1 = inWorkingDir(`epub_content_${path.parse(epubFilePath1).name}.htm`)
const combinedEpubContentPath2 = inWorkingDir(`epub_content_${path.parse(epubFilePath2).name}.htm`)

const combinedEpubContentTextPath1 = inWorkingDir(`epub_text_${path.parse(epubFilePath1).name}.txt`)
const combinedEpubContentTextPath2 = inWorkingDir(`epub_text_${path.parse(epubFilePath2).name}.txt`)

const mp3sDirectoryPath = inWorkingDir('audio')
const mp4sDirectoryPath = inWorkingDir('videos')
const videoFilenamesListPath = path.join(mp4sDirectoryPath, 'videos.txt')
const audioFilenamesListPath = inWorkingDir('audios.txt')

const autosubSrtPath = inWorkingDir('autosub.srt')

const chapterTextOutfilePath = (nameWithoutTxtExt: string) => inWorkingDir('text', `${nameWithoutTxtExt}.txt`)
const alignerTextOutfilePath = (nameWithoutTxtExt: string) => inWorkingDir('alignment', `${nameWithoutTxtExt}.txt`)
const alignerTsvOutfilePath = (nameWithoutTsvExt: string) => inWorkingDir('alignment', `${nameWithoutTsvExt}.tsv`)
const alignerTsvPath = inWorkingDir('alignment.tsv')

const syncedSrtFilePath = cwd(`${path.parse(epubFilePath1).name}.${autosubLangCode1}.srt`)
const syncedTranslationSrtFilePath = cwd(`${path.parse(epubFilePath1).name}.${autosubLangCode2}.srt`)

const imagesAndDurationsFilePath = inWorkingDir('images_and_durations.txt')
const imagesVideoPath = inWorkingDir('silent_slideshow.mp4')

start()

function prepareEpubDomForTextExtraction(
  getHtmlPaths: () => string[],
  prepareDomAndGetText: (dom: JSDOM, getText: () => string) => string,
) {
  const paths = getHtmlPaths()
  return {
    getText: () => {
      let text = ''
      for (const htmlPath of paths) {
        const dom = getDom(htmlPath)

        text += prepareDomAndGetText(dom.dom, dom.getText)
      }
      return text
    },
  }
}

function log(txt: string) {
  console.log(`=========== ${txt}`)
}

async function start() {
  const { sections } = await prepareWorkspace()

  log(`Preparing epubs for text extraction`)
  function getEpubHtmlsPaths(extractedEpubPath: string) {
    const contentDirectory = lfbContentFolderName
    const htmlFilePaths = lfbChapters.map((fn) => path.join(extractedEpubPath, contentDirectory, fn))
    return htmlFilePaths
  }
  function prepareDomText(dom: JSDOM, getText: () => string) {
    dom.window.document.querySelectorAll('.groupExtScrpCite').forEach((el) => el.parentNode!.removeChild(el))
    return getText()
  }

  const epub1 = prepareEpubDomForTextExtraction(() => getEpubHtmlsPaths(extractedEpubPath1), prepareDomText)
  const epub2 = prepareEpubDomForTextExtraction(() => getEpubHtmlsPaths(extractedEpubPath2), prepareDomText)
  const epub1Text = epub1.getText()
  const epub2Text = epub2.getText()

  log(`Writing to ${combinedEpubContentTextPath1}`)
  fs.writeFileSync(combinedEpubContentTextPath1, epub1Text, 'utf8')
  log(`Writing to ${combinedEpubContentTextPath2}`)
  fs.writeFileSync(combinedEpubContentTextPath2, epub2Text, 'utf8')

  log(`Making video at ${vidOutputPath}`)
  if (fs.existsSync(vidOutputPath)) log(`Video already exists! skipping.`)
  else
    await execPromise(
      `ffmpeg -i ${pathArg(imagesVideoPath)} -i ${pathArg(bigAudioOutputPath)} -map 0:v:0 -map 1:a:0 -r 1 ${pathArg(
        vidOutputPath,
      )}`,
    )

  log(`aligning texts!`)
  if (fs.existsSync(alignerTsvPath)) log(`Alignment already exists! skipping.`)
  else await alignTxts(combinedEpubContentTextPath1, combinedEpubContentTextPath2, alignerTsvPath, 'aligned')

  log(`getting synced srts!`)
  const synced = getSrtsFromTranscripts(sections)
  let newSrtCues: NodeCue[] = []
  let translationSrtCues: NodeCue[] = []
  for (const syncedSection of synced) {
    const { refined } = await syncedSection.sync()
    log(`writing synced srt!`)
    newSrtCues.push(...refined.srtCues)
    translationSrtCues.push(...refined.translationSrtCues)
  }
  fs.writeFileSync(
    syncedSrtFilePath,
    stringifySync(
      newSrtCues.map((c, index) => ({ ...c, index })),
      { format: 'SRT' },
    ),
    'utf8',
  )
  fs.writeFileSync(
    syncedTranslationSrtFilePath,
    stringifySync(
      translationSrtCues.map((c, index) => ({ ...c, index })),
      { format: 'SRT' },
    ),
    'utf8',
  )
}

async function workspaceStep<T>(name: string, isAlreadyDone: boolean, step: () => Promise<T> | T) {
  log('')
  log(name)
  log('')
  if (isAlreadyDone) {
    log(`Already done!`)
  } else {
    return await step()
  }
}

async function prepareWorkspace() {
  await workspaceStep(
    `Creating workspace directory at ${workspaceDirectoryPath}`,
    fs.existsSync(workspaceDirectoryPath),
    () => fs.mkdirSync(workspaceDirectoryPath),
  )

  if (!fs.existsSync(inWorkingDir('text'))) fs.mkdirSync(inWorkingDir('text'))
  if (!fs.existsSync(inWorkingDir('alignment'))) fs.mkdirSync(inWorkingDir('alignment'))

  await workspaceStep(
    `Extracting EPUB content`,
    fs.existsSync(extractedEpubPath1) && fs.existsSync(extractedEpubPath2),
    async () => {
      fs.mkdirSync(extractedEpubPath2)
      fs.mkdirSync(extractedEpubPath1)

      await Promise.all([unzipEpub(epubFilePath1, extractedEpubPath1), unzipEpub(epubFilePath2, extractedEpubPath2)])
    },
  )

  // TODO: check if desired
  await workspaceStep(
    `Building big HTML files from EPUBs`,
    fs.existsSync(combinedEpubContentPath1) && fs.existsSync(combinedEpubContentPath1),
    async () => {
      await extractEpubContents(extractedEpubPath1, combinedEpubContentPath1)
      await extractEpubContents(extractedEpubPath2, combinedEpubContentPath2)
    },
  )

  await workspaceStep(`Extracting MP3s`, fs.existsSync(mp3sDirectoryPath), async () => {
    fs.mkdirSync(mp3sDirectoryPath)
    await extractMp3s(mp3ZipFilePath, mp3sDirectoryPath)
  })

  const mp3AndMp4Paths: { mp3Path: string; mp4Path: string; i: number }[] = fs
    .readdirSync(mp3sDirectoryPath)
    .filter((path) => path.endsWith('.mp3'))
    .map((mp3Name, i) => {
      const trackName = path.parse(mp3Name).name
      log('found mp3!! ' + mp3Name)
      return {
        mp3Path: path.join(mp3sDirectoryPath, mp3Name),
        mp4Path: path.join(mp4sDirectoryPath, `${trackName}.mp4`),
        i,
      }
    })

  const epubHtmlsPaths = getEpubHtmlsPaths(extractedEpubPath1)
  const translatedEpubHtmlsPaths = getEpubHtmlsPaths(extractedEpubPath2)

  const sections: Section[] = await Promise.all(
    mp3AndMp4Paths.map(async ({ mp3Path, i }) => {
      const duration = await getDuration(mp3Path)
      const imagePath = path.join(extractedEpubPath1, lfbContentFolderName, lfbImages[i])

      const getText = prepareEpubDomForTextExtraction(() => [epubHtmlsPaths[i]], prepareDomText).getText
      const getTranslation = prepareEpubDomForTextExtraction(() => [translatedEpubHtmlsPaths[i]], prepareDomText)
        .getText
      return {
        imagePath,
        duration,
        mp3Path,
        getText,
        getTsvText: async () => {
          const name = path.parse(epubHtmlsPaths[i]).name
          const txtPath1 = chapterTextOutfilePath(`${name}___${autosubLangCode1}`)
          const txtPath2 = chapterTextOutfilePath(`${name}___${autosubLangCode2}`)
          fs.writeFileSync(txtPath1, getText())
          fs.writeFileSync(txtPath2, getTranslation())
          const tsvPath = alignerTsvOutfilePath(name)
          const alignedTsvText = await alignTxts(txtPath1, txtPath2, tsvPath, name)
          return alignedTsvText
        },
      }
    }),
  )

  await workspaceStep(`Registering MP3 durations`, fs.existsSync(imagesAndDurationsFilePath), async () => {
    const durationsContent = [...sections]
      .flatMap((d) => [`file '${d.imagePath}`, `duration ${d.duration}`])
      .concat(`file '${sections[sections.length - 1].imagePath}'`)
      .join('\n')

    await fs.promises.writeFile(imagesAndDurationsFilePath, durationsContent, 'utf8')
  })

  function getEpubHtmlsPaths(extractedEpubPath: string) {
    const contentDirectory = lfbContentFolderName
    const htmlFilePaths = lfbChapters.map((fn) => path.join(extractedEpubPath, contentDirectory, fn))
    return htmlFilePaths
  }
  function prepareDomText(dom: JSDOM, getText: () => string) {
    dom.window.document.querySelectorAll('.groupExtScrpCite').forEach((el) => el.parentNode!.removeChild(el))
    return getText()
  }

  const epub1 = prepareEpubDomForTextExtraction(() => getEpubHtmlsPaths(extractedEpubPath1), prepareDomText)
  const epub2 = prepareEpubDomForTextExtraction(() => getEpubHtmlsPaths(extractedEpubPath2), prepareDomText)
  const epub1Text = epub1.getText()
  const epub2Text = epub2.getText()

  await workspaceStep(`Creating slideshow video`, fs.existsSync(imagesVideoPath), async () => {
    await execPromise(
      `ffmpeg -safe 0 -f concat -i ${pathArg(imagesAndDurationsFilePath)} -vsync vfr -pix_fmt yuv420p ${pathArg(
        imagesVideoPath,
      )}`,
    )
  })
  await workspaceStep(`Creating videos from MP3s`, fs.existsSync(mp4sDirectoryPath), async () => {
    fs.mkdirSync(mp4sDirectoryPath)
  })

  const videoFilenamesList = mp3AndMp4Paths.map((p) => `file '${p.mp4Path}'`).join('\n')
  const audioFilenamesList = mp3AndMp4Paths.map((p) => `file '${p.mp3Path}'`).join('\n')
  console.log({ videoFilenamesList })
  if (!fs.existsSync(videoFilenamesListPath)) fs.writeFileSync(videoFilenamesListPath, videoFilenamesList, 'utf8')
  if (!fs.existsSync(audioFilenamesListPath)) fs.writeFileSync(audioFilenamesListPath, audioFilenamesList, 'utf8')

  const groupedMediaPaths = intoGroupsOfN(mp3AndMp4Paths, 5)
  for (const group of groupedMediaPaths) {
    await Promise.all(
      group.map(async ({ mp3Path, mp4Path, i }) => {
        await workspaceStep(`Creating video`, fs.existsSync(mp4Path), async () => {
          const imagePath = path.join(extractedEpubPath1, lfbContentFolderName, lfbImages[i])
          if (!imagePath) console.error(`Missing img path for ${mp3Path}`)
          // await createIndividualVideo(imagePath, mp3Path, mp4Path)
        })
      }),
    )
  }

  await workspaceStep(`Creating big audio at ${bigAudioOutputPath}`, fs.existsSync(bigAudioOutputPath), async () => {
    await concatAudios(bigAudioOutputPath)
  })

  await workspaceStep(`Creating autosub SRT at ${autosubSrtPath}`, fs.existsSync(autosubSrtPath), async () => {
    await getAutosubSrt(bigAudioOutputPath)
  })

  return { sections: sections }
}

async function unzipEpub(epubPath: string, outPath: string) {
  log(`Extracting: ${epubPath}`)
  log(`        to: ${outPath}`)
  const result = await execPromise(
    `unzip ${JSON.stringify(path.resolve(epubPath))} -d ${JSON.stringify(path.resolve(outPath))}`,
  )
  const { stdout, stderr } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
}

async function extractEpubContents(extractedEpubPath: string, outputHtmlPath: string) {
  const contentDirectory = lfbContentFolderName
  const htmlFileNames = lfbChapters.map((fn) => path.join(extractedEpubPath, contentDirectory, fn))
  for (const fn of htmlFileNames) {
    const content = fs.readFileSync(fn, 'utf8')
    fs.appendFileSync(outputHtmlPath, content)
  }
}

async function extractMp3s(zipPath: string, outDir: string) {
  log(`Extracting: ${zipPath}`)
  log(`        to: ${outDir}`)
  const result = await execPromise(`unzip ${pathArg(zipPath)} -d ${pathArg(outDir)}`)
  const { stdout, stderr } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
}

function pathArg(filePath: string) {
  return JSON.stringify(path.resolve(filePath))
}

// TODO: option for individual videos
async function createIndividualVideo(imagePath: string, mp3Path: string, outPath: string) {
  log(`Making video`)
  log(` image: ${imagePath}`)
  log(` audio: ${mp3Path}`)
  log(`    to: ${outPath}`)
  const result = await execPromise(
    `ffmpeg -loop 1 -i ${pathArg(imagePath)} -i ${pathArg(
      mp3Path,
    )} -c:a libfdk_aac -c:v libx264  -pix_fmt yuv420p -shortest -map 0:v -map 1:a  ${pathArg(outPath)}`,
  )
  const { stdout, stderr } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
  return result
}

// concat individual videos
// ffmpeg -f concat -i videos.txt -ac aac concatted.mp4
async function concatVideos(outPath: string) {
  log(`Combining videos`)
  log(`     into: ${outPath}`)
  const result = await execPromise(
    `ffmpeg -f concat -safe 0 -i ${pathArg(videoFilenamesListPath)} -c copy ${pathArg(outPath)}`,
  )
  const { stdout, stderr } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
  return result
}

async function concatAudios(outPath: string) {
  log(`Combining audios`)
  log(`     into: ${outPath}`)
  const result = await execPromise(
    `ffmpeg -f concat -safe 0 -i ${pathArg(audioFilenamesListPath)} -b:a 120k -c:a libfdk_aac -vn  ${pathArg(outPath)}`,
  )
  const { stdout, stderr } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
  return result
}

// ---NOT DOING THIS NOW, USING EPUB IMAGES---
// get cover jpg from mp3
// ffmpeg -i lfb_X_050.mp3 -an -vcodec copy cover.jpg

function intoGroupsOfN<T>(arr: T[], n: number): T[][] {
  const result: T[][] = []
  for (const item of arr) {
    const last = result[result.length - 1]
    if (last && last.length < n) {
      last.push(item)
    } else {
      result.push([item])
    }
  }
  return result
}

// LF_aligner_3.1.exe --filetype="t" --infiles="c:\alignment\input_en.txt","c:\alignment\input_fr.txt" --languages="en","fr" --segment="y" --review="n" --tmx="n"
async function alignTxts(l1TextPath: string, l2TextPath: string, tsvPath: string, name: string) {
  if (!fs.existsSync(alignerTextOutfilePath(name))) {
    const result = await execPromise(
      `${alignerExecutablePath} --filetype="t" --infiles=${pathArg(l1TextPath)},${pathArg(
        l2TextPath,
      )} --languages="${autosubLangCode1}","${autosubLangCode2}" --segment="y" --review="n" --tmx="n" --outfile=${pathArg(
        alignerTextOutfilePath(name),
      )}`,
    )
    const { stderr, stdout } = result
    log(`stdout: ${stdout}`)
    log(`stderr: ${stderr}`)
  } else {
    log(`Already aligned!`)
  }

  const txtContent = fs
    .readFileSync(alignerTextOutfilePath(name), 'utf-8')
    .split('\n')
    .filter((s) => s)
    .map((line) => line.split('\t'))
  const tsvContent = papa.unparse(txtContent, { delimiter: '\t' })
  fs.writeFileSync(tsvPath, tsvContent, 'utf8')

  return tsvContent
}

async function getAutosubSrt(inputPath: string) {
  const result = await execPromise(
    `autosub ${pathArg(inputPath)} -D ${autosubLangCode1} -S ${autosubLangCode1} -o ${pathArg(autosubSrtPath)}`,
  )
  const { stderr, stdout } = result
  log(`stdout: ${stdout}`)
  log(`stderr: ${stderr}`)
  return result
}

function getSrtsFromTranscripts(audioSections: Section[]) {
  const autoSrt = fs.readFileSync(autosubSrtPath, 'utf8')
  const allSectionsAutoSrtChunks = parseSrt(autoSrt)

  // since the subtitles/cue times come from the big concat'd aac
  // but the durations come from ffmpeg (and are probably imperfect)
  // there is some drift.
  // this padding works for lfb, so we can judge the start/end of each sections' subtitles cues
  // pretty accurately
  const PADDING = -0.020417745762689125
  const { startsAndEnds: sectionStartsAndEnds } = audioSections.reduce(
    (acc, { duration }) => {
      const paddedDuration = duration + PADDING
      acc.startsAndEnds.push({
        start: acc.totalTime,
        end: acc.totalTime + paddedDuration,
      })
      acc.totalTime += paddedDuration
      return acc
    },
    { startsAndEnds: [] as { start: number; end: number }[], totalTime: 0 },
  )

  // TODO: assert no chunks repeated
  const refined = sectionStartsAndEnds.map((section, sectionIndex) => {
    // TODO: optimize
    const sectionChunks = allSectionsAutoSrtChunks
      .filter((chunk) => {
        const chunkStartSeconds = chunk.start / 1000

        return chunkStartSeconds < section.end && chunkStartSeconds >= section.start
      })
      .map((s, index) => ({ start: s.start, end: s.end, absoluteIndex: s.index, relativeIndex: index, text: s.text }))

    return {
      sync: async () => {
        const sectionSegments = getTsvSegmentsFromText(await audioSections[sectionIndex].getTsvText()).map(
          (s, index) => ({
            ...s,
            index,
          }),
        )
        const synced = syncTranscriptWithSubtitles(
          sectionSegments,
          sectionChunks.map((s) => ({ ...s, index: s.relativeIndex })),
        )
        console.log({ sectionChunks: sectionChunks })
        const refined = refineSrtWithTranscript(
          stringifySync(
            sectionChunks.map((s) => ({
              type: 'cue',
              data: s,
            })),
            { format: 'SRT' },
          ),
          synced,
        )
        logMatchesResult(
          synced.matches,
          synced.analyzedTranscript,
          sectionChunks.map((s) => ({ ...s, index: s.relativeIndex })),
        )
        return { synced, refined }
      },
    }
  })
  return refined
}

async function getDuration(mp3Path: string): Promise<number> {
  const { stdout, stderr } = await execPromise(
    `ffmpeg -i ${pathArg(mp3Path)} 2>&1 | grep Duration | sed 's/Duration: \(.*\), start/\1/g'`,
  )

  if (stderr) {
    console.log('stderr: ' + stderr)
    throw new Error(`Problem getting duration for ` + mp3Path)
  }

  const segments = stdout.match(/(\d+):(\d+):(\d+\.?\d+)/)
  if (!segments) throw new Error(`Invalid duration for ${mp3Path} \n ${stdout}`)
  const [, hr, m, s] = segments
  const hours = Number(hr)
  const minutes = Number(m)
  const seconds = Number(s)

  return hours * 60 * 60 + minutes * 60 + seconds
}
