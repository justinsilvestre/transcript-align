import React, { useState } from 'react'
import './App.css'
import { alignWithSrt } from './alignWithSrt'
import { isMatch, MatchStatusRegion } from './getRegionsByMatchStatus'
import { hanaOriginalText } from '../testData/hanaOriginalText'
import { hanaSrt } from '../testData/hanaSrt'
import { buildAlignedSrt } from './buildAlignedSrt'
import { BaseTextSubsegment, MatchedBaseTextSubsegments } from './syncTranscriptWithSubtitles'

const App: React.FC = () => {
  const [baseText, setBaseText] = useState<string>(hanaOriginalText)
  const [srtText, setSrtText] = useState<string>(hanaSrt)

  const alignment = alignWithSrt(baseText, srtText)
  const { regions, getBaseTextSubsegmentText, getTtsSegmentText, baseTextSubsegments, results } = alignment

  const totalMatches = results.filter((result) => isMatch(result)).length
  console.log('Total matches:', totalMatches)

  return (
    <div className="p-4">
      <header>
        <h1>Transcript Align</h1>
        <p>Align transcript text with SRT subtitles</p>
      </header>
      <main>
        <div className="flex gap-6 my-4">
          <div className="flex-1 flex flex-col">
            <label htmlFor="base-text" className="mb-1 font-semibold">
              Base Text:
            </label>
            <textarea
              id="base-text"
              className="p-2 border rounded min-h-[160px] resize-vertical"
              value={baseText}
              onChange={(e) => setBaseText(e.target.value)}
              placeholder="Enter your base text here..."
              rows={10}
            />
          </div>
          <div className="flex-1 flex flex-col">
            <label htmlFor="srt-text" className="mb-1 font-semibold">
              SRT Text:
            </label>
            <textarea
              id="srt-text"
              className="p-2 border rounded min-h-[160px] resize-vertical"
              value={srtText}
              onChange={(e) => setSrtText(e.target.value)}
              placeholder="Enter your SRT text here..."
              rows={10}
            />
          </div>
          <div className="flex flex-col justify-end">
            <button
              className="mb-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                const alignedSrt = buildAlignedSrt({ ...alignment, srtText })

                const blob = new Blob([alignedSrt], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'aligned.srt'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)

                alert('Aligned SRT downloaded successfully!')
              }}
            >
              Download Aligned SRT
            </button>
            <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={async () => {
                const alignedSrt = buildAlignedSrt({ ...alignment, srtText })
                await navigator.clipboard.writeText(alignedSrt)
                alert('Aligned SRT copied to clipboard!')
              }}
            >
              Copy Aligned SRT
            </button>
          </div>
        </div>
        <button>Align Transcript</button>
        <div>
          <h2>Results</h2>
          <div>
            {regions.map((region, index) => (
              <RegionDisplay
                key={index}
                index={index}
                region={region}
                baseTextSubsegments={baseTextSubsegments}
                getBaseTextSubsegmentText={getBaseTextSubsegmentText}
                getTtsSegmentText={getTtsSegmentText}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function RegionDisplay({
  index,
  region,
  baseTextSubsegments,
  getBaseTextSubsegmentText,
  getTtsSegmentText,
}: {
  index: number
  region: MatchStatusRegion
  baseTextSubsegments: BaseTextSubsegment[]
  getBaseTextSubsegmentText: (index: number) => string
  getTtsSegmentText: (index: number) => string
}) {
  return (
    <div key={index} className={`flex gap-5 my-1 rounded ${region.isMatching ? '' : 'bg-gray-200'}`}>
      <div className="flex-1 p-1 bg-gray-100 rounded">
        {region.results.map((result, resIndex) => {
          const subsegments = getArrayIndices(
            isMatch(result) ? result.subsegments.start : result.baseTextSubsegmentIndex,
            isMatch(result) ? result.subsegments.end : result.baseTextSubsegmentIndex + 1,
          ).map((index) => baseTextSubsegments[index])

          if (isMatch(result)) {
            return (
              <MatchResultDisplay
                key={resIndex}
                result={result}
                resIndex={resIndex}
                getBaseTextSubsegmentText={getBaseTextSubsegmentText}
                getTtsSegmentText={getTtsSegmentText}
              />
            )
          }
          return (
            <div key={String(resIndex)} className="p-1">
              {getBaseTextSubsegmentText(result.baseTextSubsegmentIndex)}
            </div>
          )
        })}
      </div>
      {!region.isMatching && (
        <div className="flex-1 p-1 bg-gray-100 rounded">
          {getArrayIndices(region.ttsSegments.start, region.ttsSegments.end).map((i) => {
            const text = getTtsSegmentText(i)
            return (
              <div key={i} className="p-1 flex flex-col">
                <span className="">{text}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MatchResultDisplay({
  result,
  resIndex,
  getBaseTextSubsegmentText,
  getTtsSegmentText,
}: {
  result: MatchedBaseTextSubsegments
  resIndex: number
  getBaseTextSubsegmentText: (index: number) => string
  getTtsSegmentText: (index: number) => string
}) {
  let highlight = 'bg-gray-100' // Default highlight color
  if (/^\d+$/.test(result.matchParameters.pass)) {
    const lev = result.matchParameters.levenshteinThreshold
    if (lev <= 1) highlight = 'bg-green-50'
    else if (lev <= 2) highlight = 'bg-green-100'
    else if (lev <= 3) highlight = 'bg-green-200'
    else if (lev <= 4) highlight = 'bg-green-300'
    else if (lev <= 5) highlight = 'bg-green-400'
    else if (lev <= 6) highlight = 'bg-gray-100'
  } else {
    if (result.matchParameters.pass === 'topImprovement') highlight = 'bg-blue-100'

    if (result.matchParameters.pass === 'bottomImprovement') highlight = 'bg-orange-100'

    if (result.matchParameters.pass === 'straggler') highlight = 'bg-purple-100'
  }

  return (
    <div key={String(resIndex)} className={`p-1 rounded ${highlight} flex flex-col`}>
      <span className="">
        {getArrayIndices(result.subsegments.start, result.subsegments.end)
          .map((i) => getBaseTextSubsegmentText(i))
          .join(' - ')}
      </span>
      <span className="text-blue-600">
        {getArrayIndices(result.ttsSegments.start, result.ttsSegments.end)
          .map((i) => getTtsSegmentText(i))
          .join(' - ')}
      </span>
      <div className="text-green-600 h-[4px] leading-0.5">
        {Array(result.matchParameters.minMatchLength).fill('•').join('\u00A0\u00A0\u00A0')}
      </div>
    </div>
  )
}

function getArrayIndices(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start)
}

export default App
