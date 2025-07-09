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

export function parseSrtCues(srtText: string) {
  return parseSrt(srtText)
}

export function parseSrt(srtText: string): Node[] {
  const nodes: Node[] = []
  const blocks = srtText.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.trim().split('\n')

    // Skip sequence number (first line)
    if (lines.length < 3) continue

    // Parse timestamp line (second line)
    const timestampLine = lines[1]
    const timestampMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)

    if (!timestampMatch) continue

    const startTime = parseTimestamp(timestampMatch[1])
    const endTime = parseTimestamp(timestampMatch[2])

    // Text content (remaining lines)
    const text = lines.slice(2).join('\n')

    nodes.push({
      type: 'cue',
      data: {
        start: startTime,
        end: endTime,
        text: text,
      },
    })
  }

  return nodes
}

export function buildSrt(cues: Node[]): string {
  let srtContent = ''
  let sequenceNumber = 1

  for (const node of cues) {
    if (node.type === 'cue') {
      const { start, end, text } = node.data

      srtContent += `${sequenceNumber}\n`
      srtContent += `${formatTimestamp(start)} --> ${formatTimestamp(end)}\n`
      srtContent += `${text}\n\n`

      sequenceNumber++
    }
  }

  return srtContent.trim()
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
