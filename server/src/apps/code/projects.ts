import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { appDir } from '../../paths.js'
import { prepareRepository, projectRepoDir, repoDir, RepositoryError } from './repositories.js'
import type { Project } from './types.js'

export const defaultProject = 'binos'
const file = path.join(appDir('code'), 'projects.json')

export function listProjects(): Project[] {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Project[] : [{ id: defaultProject, name: 'binOS' }]
}

export const projectExists = (id: string) => listProjects().some((project) => project.id === id)

function saveProject(project: Project) {
  const projects = listProjects()
  const index = projects.findIndex((item) => item.id === project.id)
  if (index < 0) projects.push(project)
  else projects[index] = project
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(projects, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
  return project
}

export async function createProject(name: string, repository: string, create = false): Promise<Project> {
  const id = randomUUID()
  const info = await prepareRepository(id, repository, create)
  return saveProject({ id, name, ...info })
}

const preparing = new Set<string>()

export async function connectProject(id: string, repository: string, create = false): Promise<Project> {
  const project = listProjects().find((item) => item.id === id)
  if (!project || id === defaultProject || project.repository || preparing.has(id)) {
    throw new RepositoryError('项目不存在、已关联仓库或正在关联仓库')
  }
  preparing.add(id)
  try {
    const info = await prepareRepository(id, repository, create)
    return saveProject({ ...project, ...info })
  } finally {
    preparing.delete(id)
  }
}

export function projectDirectory(id = defaultProject): string {
  if (id === defaultProject) return repoDir
  const project = listProjects().find((item) => item.id === id)
  if (!project?.repository) throw new RepositoryError('请先为这个项目关联 GitHub 仓库')
  return projectRepoDir(id)
}
