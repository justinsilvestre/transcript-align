import { JSDOM } from 'jsdom'
import { readFileSync } from 'fs'

const ZERO_WIDTH_SPACE = String.fromCharCode(8203)

export function getDom(filePath: string) {
  const htmlFileContents = readFileSync(filePath, 'utf8')
  const dom = new JSDOM(htmlFileContents)
  
  console.log('------------------- got dom for ' + filePath)
  return {
    dom,
    getText: () => dom.window.document.body.textContent!.replace(new RegExp(ZERO_WIDTH_SPACE, 'ug'), ''),
  }
}
