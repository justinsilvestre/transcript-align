import { parseSync } from 'subtitle';
import { readFileSync } from 'fs';
import * as papa from 'papaparse';

// TODO: check translation
export function getTsvSegments(tsvFilePath: string) {
  return papa.parse(readFileSync(tsvFilePath, 'utf8'), { delimiter: '\t' })
    .data
    .map((line, index) => {
      const [text, translation] = line as any;
      return {
        text,
        translation,
        index,
      };
    });
}

export function getTsvSegmentsFromText(text: string) {
  return papa.parse(text, { delimiter: '\t' })
    .data
    .map((line, index) => {
      const [text, translation] = line as any;
      return {
        text,
        translation,
        index,
      };
    });
}

export function parseSrt(srtFilePath: string) {
  return parseSync(srtFilePath).map((n, i) => {
    if (n.type === 'header') throw new Error('Check srt, should be just cues')
    return ({
      text: typeof n.data === 'string' ? n.data : n.data.text,
      index: i,
      /** ms */
      start: n.data.start,
      /** ms */
      end: n.data.end,
    });
  });
}
