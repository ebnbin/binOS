import { useMemo } from 'react'
import { builtinApplications, placeholderApplications } from './builtins.ts'
import { validateApplications } from './definitions.ts'
import { externalApp } from './external/index.ts'
import { useExternalApps } from './external/registry.ts'
import type { ApplicationDefinition } from './types.ts'

// 内置的 app 加上 app 注册表里的外部 app，按这个顺序排列
export function useApplications(): ApplicationDefinition[] {
  const external = useExternalApps()
  return useMemo(() => validateApplications([...builtinApplications, ...(external ?? []).map(externalApp), ...placeholderApplications]), [external])
}

// 读到 app 注册表之前，还不知道有哪些外部 app
export const useApplicationsLoaded = () => useExternalApps() !== undefined
