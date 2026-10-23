import type { ThemeRegistrationRaw } from 'shiki/core'

// GtkSourceView 官方的 Adwaita 和 Adwaita-dark 配色方案（gtksourceview/data/styles），按 TextMate 作用域改写成 Shiki 主题。
// 方案里的 def:statement、def:type 是粗体；斜体不用
type Scheme = {
  text: string
  background: string
  comment: string
  string: string
  number: string
  statement: string
  type: string
  function: string
  identifier: string
  preprocessor: string
  specialChar: string
  heading: string
  link: string
  attribute: string
  element: string
  property: string
  added: string
  removed: string
  location: string
  diffFile: string
}

function theme(name: string, type: 'light' | 'dark', c: Scheme): ThemeRegistrationRaw {
  const rule = (scope: string[], foreground: string, fontStyle = '') => ({ scope, settings: { foreground, fontStyle } })
  return {
    name,
    type,
    colors: { 'editor.background': c.background, 'editor.foreground': c.text },
    settings: [
      { settings: { foreground: c.text, background: c.background } },
      rule(['comment', 'punctuation.definition.comment', 'string.comment'], c.comment),
      rule(['string', 'punctuation.definition.string', 'string.template', 'string.regexp'], c.string),
      rule(['constant.numeric', 'constant.language', 'constant.other', 'support.constant', 'variable.language', 'constant.character', 'markup.inline.raw', 'markup.raw'], c.number),
      rule(['constant.character.escape', 'string.regexp constant.character.escape'], c.specialChar),
      rule(['keyword', 'storage', 'storage.modifier', 'keyword.control', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical.python', 'markup.list', 'punctuation.definition.list'], c.statement, 'bold'),
      rule(['keyword.operator', 'punctuation'], c.text),
      rule(['storage.type', 'support.type', 'entity.name.type', 'entity.name.class', 'entity.other.inherited-class', 'entity.name.namespace', 'support.class'], c.type, 'bold'),
      rule(['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'variable.function'], c.function),
      rule(['meta.preprocessor', 'keyword.control.directive', 'entity.name.function.preprocessor', 'keyword.control.import', 'keyword.control.export', 'keyword.control.from'], c.preprocessor),
      rule(['entity.name.tag', 'support.class.component'], c.element),
      rule(['entity.other.attribute-name'], c.attribute),
      rule(['support.type.property-name', 'meta.object-literal.key', 'variable.other.property'], c.property),
      rule(['markup.heading', 'entity.name.section', 'markup.heading punctuation.definition.heading'], c.heading, 'bold'),
      rule(['markup.bold'], c.text, 'bold'),
      rule(['markup.underline.link', 'string.other.link'], c.link),
      rule(['markup.inserted', 'meta.diff.header.to-file'], c.added),
      rule(['markup.deleted', 'meta.diff.header.from-file'], c.removed),
      rule(['meta.diff.range', 'meta.diff.header'], c.location),
      rule(['meta.diff.index', 'meta.diff.header.command'], c.diffFile),
      rule(['variable.other.constant'], c.identifier),
    ],
  }
}

export const adwaitaLight = theme('adwaita', 'light', {
  text: '#3D3846',
  background: '#FFFFFF',
  comment: '#77767B',
  string: '#218787',
  number: '#4E57BA',
  statement: '#C64600',
  type: '#218787',
  function: '#1C71D8',
  identifier: '#4E9A06',
  preprocessor: '#C64600',
  specialChar: '#ED333B',
  heading: '#218787',
  link: '#3584E4',
  attribute: '#C64600',
  element: '#218787',
  property: '#C64600',
  added: '#26A1A2',
  removed: '#F66151',
  location: '#D38B09',
  diffFile: '#4E57BA',
})

export const adwaitaDark = theme('adwaita-dark', 'dark', {
  text: '#C0BFBC',
  background: '#1D1D20',
  comment: '#777777',
  string: '#5BC8AF',
  number: '#7D8AC7',
  statement: '#FFA348',
  type: '#5BC8AF',
  function: '#62A0EA',
  identifier: '#4E9A06',
  preprocessor: '#E66100',
  specialChar: '#F66151',
  heading: '#33B2A4',
  link: '#62A0EA',
  attribute: '#FF7800',
  element: '#33B2A4',
  property: '#FF7800',
  added: '#33B2A4',
  removed: '#F66151',
  location: '#F5C211',
  diffFile: '#7D8AC7',
})
