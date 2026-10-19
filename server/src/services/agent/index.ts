// agent 服务：任何 app 都可以用它让 agent 干活。服务只管一次次的运行（run），怎么组织运行（比如对话）由 app 自己决定
export { fitOptions, resumeRuns, startRun, viewHint } from './runs.js'
export type { Run, RunHandler, RunOptions } from './runs.js'
