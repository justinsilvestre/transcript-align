import { describe, it, expect } from 'vitest'
import { parseSrtCues, formatCueTime } from './srtHelpers'

describe('parseSrtCues', () => {
  const srtText = `1
00:00:01,024 --> 00:00:01,792
羅生門


2
00:00:02,560 --> 00:00:04,096
芥川龍之介



3
00:00:06,400 --> 00:00:08,448
ある日の暮方の事である。

4
00:00:08,960 --> 00:00:11,264
一人の下人が、

5
00:00:11,520 --> 00:00:14,848
羅生門の下で雨やみを待っていた。


6
00:00:15,872 --> 00:00:17,920
広い門の下には、

7
00:00:18,176 --> 00:00:20,224
この男のほかに誰もいない。

8
00:00:21,504 --> 00:00:22,272
ただ、

9
00:00:22,528 --> 00:00:26,880
所々丹塗の剥げた、

10
00:00:27,392 --> 00:00:29,952
大きな円柱に、蟋蟀が一匹とまっている。`

  it('parses a simple SRT file', () => {
    const cues = parseSrtCues(srtText)

    expect(cues).toEqual([
      { type: 'cue', data: { start: 1024, end: 1792, text: '羅生門' } },
      { type: 'cue', data: { start: 2560, end: 4096, text: '芥川龍之介' } },
      { type: 'cue', data: { start: 6400, end: 8448, text: 'ある日の暮方の事である。' } },
      { type: 'cue', data: { start: 8960, end: 11264, text: '一人の下人が、' } },
      { type: 'cue', data: { start: 11520, end: 14848, text: '羅生門の下で雨やみを待っていた。' } },
      { type: 'cue', data: { start: 15872, end: 17920, text: '広い門の下には、' } },
      { type: 'cue', data: { start: 18176, end: 20224, text: 'この男のほかに誰もいない。' } },
      { type: 'cue', data: { start: 21504, end: 22272, text: 'ただ、' } },
      { type: 'cue', data: { start: 22528, end: 26880, text: '所々丹塗の剥げた、' } },
      { type: 'cue', data: { start: 27392, end: 29952, text: '大きな円柱に、蟋蟀が一匹とまっている。' } },
    ])
  })

  it('preserves trailing newlines when specified', () => {
    const cues = parseSrtCues(srtText, { preserveTrailingNewlines: true })

    expect(cues).toEqual([
      { type: 'cue', data: { start: 1024, end: 1792, text: '羅生門\n' } },
      { type: 'cue', data: { start: 2560, end: 4096, text: '芥川龍之介\n\n' } },
      { type: 'cue', data: { start: 6400, end: 8448, text: 'ある日の暮方の事である。' } },
      { type: 'cue', data: { start: 8960, end: 11264, text: '一人の下人が、' } },
      { type: 'cue', data: { start: 11520, end: 14848, text: '羅生門の下で雨やみを待っていた。\n' } },
      { type: 'cue', data: { start: 15872, end: 17920, text: '広い門の下には、' } },
      { type: 'cue', data: { start: 18176, end: 20224, text: 'この男のほかに誰もいない。' } },
      { type: 'cue', data: { start: 21504, end: 22272, text: 'ただ、' } },
      { type: 'cue', data: { start: 22528, end: 26880, text: '所々丹塗の剥げた、' } },
      { type: 'cue', data: { start: 27392, end: 29952, text: '大きな円柱に、蟋蟀が一匹とまっている。' } },
    ])
  })
})
