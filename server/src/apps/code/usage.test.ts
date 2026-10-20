import { describe, expect, it } from 'vitest'
import { estimateRate } from './usage.js'
import type { Sample } from './usage.js'

const sample = (utilization: number, cost: number, resetsAt = 1): Sample => ({ time: '', resetsAt, utilization, cost })

describe('estimateRate', () => {
  it('取只有 binOS 在用的那段的涨幅：别处也在用的区间涨得多，不影响结果', () => {
    // 每美元 1%：0→10 美元涨了 10%；10→20 美元期间别处又用了 15%
    const rate = estimateRate([sample(0.1, 0), sample(0.2, 10), sample(0.45, 20)])
    expect(rate).toBeCloseTo((0.1 + 0.01) / 10)
  })

  it('涨得太少的区间和跨了窗口的两个点不用', () => {
    expect(estimateRate([sample(0.1, 0), sample(0.12, 10)])).toBeUndefined()
    expect(estimateRate([sample(0.5, 0, 1), sample(0.1, 10, 2)])).toBeUndefined()
  })
})
