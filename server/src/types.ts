export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// 系统状态的一项改动，value 为 null 表示删除
export type StateChange = { key: string; value: JsonValue }

// version 是这一项最后一次被改动时的系统状态版本
export type StateEntry = { key: string; value: JsonValue; version: number }

// /api/events 推送的全局通知。session：对话新建、开始回答、回答结束，页面收到后重新读取列表；state：系统状态的改动
export type ChangeEvent = { type: 'session'; id: number } | { type: 'state'; version: number; changes: StateChange[] }
