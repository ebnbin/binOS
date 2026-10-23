import { GlobeIcon, LockIcon } from '@primer/octicons-react'

// 地址栏前面的图标：HTTPS 是锁，其他是地球
export const addressIcon = (url: string) => (url.startsWith('https:') ? LockIcon : GlobeIcon)
