import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { appDir } from '../../paths.js'
import type { Project } from './types.js'

export const defaultProject = 'binos'
const file = path.join(appDir('code'), 'projects.json')

export function listProjects(): Project[] {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Project[] : [{ id: defaultProject, name: 'binOS' }]
}

export const projectExists = (id: string) => listProjects().some((project) => project.id === id)

export function createProject(name: string): Project {
  const projects = listProjects()
  const project = { id: randomUUID(), name }
  projects.push(project)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(projects, null, 2) + '\n')
  renameSync(`${file}.tmp`, file)
  return project
}
