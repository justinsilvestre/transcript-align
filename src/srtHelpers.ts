export interface Timestamp {
  start: number
  end: number
  settings?: string
}
export interface Cue extends Timestamp {
  text: string
}
export declare type Format = 'SRT' | 'WebVTT'
export interface FormatOptions {
  format: Format
}
export interface NodeHeader {
  type: 'header'
  data: string
}
export interface NodeCue {
  type: 'cue'
  data: Cue
}
export declare type Node = NodeHeader | NodeCue
export declare type NodeList = Node[]

export function parseSrtCues(srtText: string, options: { preserveTrailingNewlines?: boolean } = {}) {
  return parseSrt(srtText, options).filter((n): n is NodeCue => n.type === 'cue')
}

export function parseSrt(srtText: string, options: { preserveTrailingNewlines?: boolean } = {}): Node[] {
  const nodes: Node[] = []
  // Split into cue blocks by two newlines
  const blocks = options.preserveTrailingNewlines ? splitDoubleBreaks(srtText) : srtText.split(/\n\n+/)

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.split('\n')
    if (lines.length < 3) continue

    const timestampLine = lines[1]
    const timestampMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timestampMatch) continue

    const startTime = parseTimestamp(timestampMatch[1])
    const endTime = parseTimestamp(timestampMatch[2])
    // Text content (remaining lines)
    let textLines = lines.slice(2)
    let text = textLines.join('\n')

    nodes.push({
      type: 'cue',
      data: {
        start: startTime,
        end: endTime,
        text,
      },
    })
  }

  return nodes
}

function splitDoubleBreaks(str: string) {
  const out = []
  const re = /\n\n+/g
  let lastIndex = 0,
    m

  while ((m = re.exec(str)) !== null) {
    const runStart = m.index
    const runLength = m[0].length
    // take text since the last split, plus any extra newlines beyond the first two
    out.push(str.slice(lastIndex, runStart) + '\n'.repeat(runLength - 2))
    lastIndex = re.lastIndex
  }

  // whatever is left after the last run
  out.push(str.slice(lastIndex))
  return out
}

export function buildSrt(cues: Node[]): string {
  let srtContent = ''
  let sequenceNumber = 1

  for (const node of cues) {
    if (node.type === 'cue') {
      const { start, end, text } = node.data

      srtContent += `${sequenceNumber}\n`
      srtContent += formatCueTime(start, end)
      srtContent += `${text}\n\n`

      sequenceNumber++
    }
  }

  return srtContent.trim()
}

export function formatCueTime(start: number, end: number) {
  return `${formatTimestamp(start)} --> ${formatTimestamp(end)}\n`
}

function parseTimestamp(timestamp: string): number {
  // Convert SRT timestamp (HH:MM:SS,mmm) to milliseconds
  const [time, ms] = timestamp.split(',')
  const [hours, minutes, seconds] = time.split(':').map(Number)

  return (hours * 3600 + minutes * 60 + seconds) * 1000 + Number(ms)
}

function formatTimestamp(milliseconds: number): string {
  // Convert milliseconds to SRT timestamp format (HH:MM:SS,mmm)
  const totalSeconds = Math.floor(milliseconds / 1000)
  const ms = milliseconds % 1000

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}
