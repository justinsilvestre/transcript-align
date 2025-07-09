import React, { useState } from 'react'
import './App.css'
import { rashomonOriginalText } from '../testData/rashomonOriginalText'
import { rashomonSrt } from '../testData/rashomonSrt'
import { alignWithSrt } from './alignWithSrt'
import { isMatch } from './getRegionsByMatchStatus'

const App: React.FC = () => {
  const [baseText, setBaseText] = useState<string>(rashomonOriginalText)
  const [srtText, setSrtText] = useState<string>(rashomonSrt)

  const { regions, getBaseTextSubsegmentText, getTtsSegmentText, baseTextSubsegments, results } = alignWithSrt(
    baseText,
    srtText,
  )

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
        </div>
        <button>Align Transcript</button>
        <div>
          <h2>Results</h2>
          <div>
            {regions.map((region, index) => (
              <div key={index} className={`flex gap-5 my-1 rounded ${region.isMatching ? '' : 'bg-gray-200'}`}>
                <div className="flex-1 p-1 bg-gray-100 rounded">
                  {region.results.map((result, resIndex) => {
                    const subsegments = getArrayIndices(
                      isMatch(result) ? result.subsegments.start : result.baseTextSubsegmentIndex,
                      isMatch(result) ? result.subsegments.end : result.baseTextSubsegmentIndex + 1,
                    ).map((index) => baseTextSubsegments[index])

                    if (isMatch(result)) {
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
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function getArrayIndices(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => i + start)
}

function getElementsInRange<T>(array: T[], range: { start: number; end: number }): T[] {
  return array.slice(range.start, range.end)
}

export default App
