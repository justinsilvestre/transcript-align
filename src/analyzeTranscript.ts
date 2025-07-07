export class AnalyzedTranscript {
  segments: TranscriptSegment[]
  /** more granular than `segments`, produced according to `segmenter` RegExp. */
  atoms: TranscriptAtom[]

  constructor(input: TranscriptSegmentInput[], segmenter: RegExp) {
    let absoluteAtomIndex = 0
    const segments: TranscriptSegment[] = []
    const allAtoms: TranscriptAtom[] = []

    for (const segmentInput of input) {
      if (!segmentInput.text) {
        throw new Error(`Segment at index ${segmentInput.index} has no text`)
      }
    }

    for (const segmentInput of input) {
      const segmentAtoms: TranscriptAtom[] = []
      const segment: TranscriptSegment = {
        atoms: segmentAtoms,
        text: segmentInput.text,
        index: segmentInput.index,
        translation: segmentInput.translation,
      }

      const matches = segmentInput.text.matchAll(segmenter)

      segments.push(segment)
      segmentAtoms.push(
        ...Array.from(matches, (match, relativeIndex) => {
          const currentAbsoluteIndex = absoluteAtomIndex
          absoluteAtomIndex += 1
          return new TranscriptAtom(
            segment,
            currentAbsoluteIndex,
            relativeIndex,
            match.index as number,
            ((match.index as number) + match[0].length) as number,
          )
        }),
      )

      allAtoms.push(...segmentAtoms)
    }

    this.atoms = allAtoms
    this.segments = segments
  }

  atomAt([segmentIndex, atomRelativeIndex]: TranscriptAtomIndex) {
    const segment = this.segments[segmentIndex]
    if (!segment)
      throw new Error(`Could not find segment at index ${segmentIndex} within ${this.segments.length} segments`)
    return segment.atoms[atomRelativeIndex]
  }

  toAbsoluteAtomIndex(atomIndex: TranscriptAtomIndex) {
    return this.atomAt(atomIndex).absoluteIndex
  }
}

export function analyzeTranscript(
  transcriptSegmentsInput: TranscriptSegmentInput[],
  transcriptSegmenters: RegExp,
): AnalyzedTranscript {
  return new AnalyzedTranscript(transcriptSegmentsInput, transcriptSegmenters)
}

export type TranscriptSegment = {
  index: number
  text: string
  translation: string
  atoms: TranscriptAtom[]
}

/** segment of manual transcript */
export type TranscriptSegmentInput = {
  index: number
  text: string
  translation: string
}

export class TranscriptAtom {
  segmentIndex: number
  segment: TranscriptSegment
  relativeIndex: number
  absoluteIndex: number
  start: number
  end: number

  constructor(segment: TranscriptSegment, index: number, relativeIndex: number, start: number, end: number) {
    this.absoluteIndex = index
    this.relativeIndex = relativeIndex
    this.segment = segment
    this.start = start
    this.end = end
    this.segmentIndex = segment.index
  }

  get text() {
    return this.segment.text.slice(this.start, this.end)
  }

  get index(): TranscriptAtomIndex {
    return [this.segmentIndex, this.relativeIndex]
  }
}

export type TranscriptAtomIndex = [number, number]
