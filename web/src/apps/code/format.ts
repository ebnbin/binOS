// 大约占周额度多少：不到 1% 时多留一位小数
export const formatQuota = (quota: number) => `${quota < 0.01 ? (quota * 100).toFixed(1) : Math.round(quota * 100)}%`
