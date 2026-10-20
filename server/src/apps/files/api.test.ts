import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'
import { filesApi } from './api.js'

const root = await mkdtemp(path.join(os.tmpdir(), 'binos-files-'))
afterAll(() => rm(root, { recursive: true, force: true }))
const operate = (body: object) =>
  filesApi.request('/operation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

it('浏览真实路径并识别指向目录的符号链接与损坏链接', async () => {
  const dir = path.join(root, 'browse')
  await mkdir(dir)
  await mkdir(path.join(dir, 'folder'))
  await symlink('folder', path.join(dir, 'link'))
  await symlink('missing', path.join(dir, 'broken'))
  const response = await filesApi.request(`/?path=${encodeURIComponent(dir)}`)
  expect(response.status).toBe(200)
  const listing = (await response.json()) as { entries: unknown[] }
  expect(listing.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'link', directory: true, symlink: true }),
      expect.objectContaining({ name: 'broken', directory: false, symlink: true }),
    ]),
  )
  expect((await filesApi.request('/?path=relative')).status).toBe(400)
})

it('复制保留链接，拒绝覆盖同名文件和复制到自身子目录，重命名和移动保留内容', async () => {
  const source = path.join(root, 'source')
  const target = path.join(root, 'target')
  await mkdir(source)
  await mkdir(target)
  await writeFile(path.join(source, 'file.txt'), 'original')
  await symlink('file.txt', path.join(source, 'alias'))
  expect((await operate({ action: 'copy', path: source, destination: target })).status).toBe(200)
  expect(await readFile(path.join(target, 'source', 'alias'), 'utf8')).toBe('original')
  expect((await operate({ action: 'copy', path: source, destination: source })).status).toBe(400)
  expect((await operate({ action: 'copy', path: source, destination: target })).status).toBe(400)
  expect((await operate({ action: 'rename', path: path.join(source, 'file.txt'), name: 'renamed.txt' })).status).toBe(200)
  expect((await operate({ action: 'move', path: path.join(source, 'renamed.txt'), destination: target })).status).toBe(200)
  expect(await readFile(path.join(target, 'renamed.txt'), 'utf8')).toBe('original')
  expect((await operate({ action: 'mkdir', path: target, name: '../escape' })).status).toBe(400)
  expect((await operate({ action: 'mkdir', path: target, name: '新文件夹' })).status).toBe(200)
})

it('上传拒绝覆盖，预览支持 Range 与元数据，HTML 作为附件返回', async () => {
  const dir = path.join(root, 'upload')
  await mkdir(dir)
  const query = new URLSearchParams({ path: dir, name: 'example.html' })
  const upload = () => filesApi.request(`/upload?${query}`, { method: 'POST', body: '<b>hello</b>', headers: { 'Content-Type': 'application/octet-stream' } })
  expect((await upload()).status).toBe(200)
  expect((await upload()).status).toBe(400)
  expect(await readdir(dir)).toEqual(['example.html'])
  const url = `/download?${new URLSearchParams({ path: path.join(dir, 'example.html') })}`
  const response = await filesApi.request(url, { headers: { Range: 'bytes=3-7' } })
  expect(response.status).toBe(206)
  expect(await response.text()).toBe('hello')
  expect(response.headers.get('Content-Disposition')).toBe('attachment')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect((await filesApi.request(url + '&info=1')).status).toBe(200)
  expect((await filesApi.request(url, { headers: { Range: 'bytes=999-' } })).status).toBe(416)
})

it('移到废纸篓保留名称，同名文件共存，可通过移动恢复', async () => {
  const home = path.join(root, 'trash-home')
  await mkdir(home)
  const mock = vi.spyOn(os, 'homedir').mockReturnValue(home)
  try {
    const file = path.join(home, 'example.txt')
    await writeFile(file, 'first')
    expect((await operate({ action: 'trash', path: file })).status).toBe(200)
    await writeFile(file, 'second')
    expect((await operate({ action: 'trash', path: file })).status).toBe(200)
    const trash = path.join(home, '.Trash')
    expect((await readdir(trash)).length).toBe(2)
    expect((await operate({ action: 'move', path: path.join(trash, 'example.txt'), destination: home })).status).toBe(200)
    expect(await readFile(file, 'utf8')).toBe('first')
    expect((await operate({ action: 'trash', path: home })).status).toBe(400)
  } finally {
    mock.mockRestore()
  }
})
