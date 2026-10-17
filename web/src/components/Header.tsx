export function Header({
  showList,
  onToggleList,
  onNew,
  canStartNew,
}: {
  showList: boolean
  onToggleList: () => void
  onNew: () => void
  canStartNew: boolean
}) {
  return (
    <header className="header">
      <span>binOS</span>
      <div className="header-actions">
        <button type="button" onClick={onToggleList}>
          {showList ? '返回' : '列表'}
        </button>
        <button type="button" onClick={onNew} disabled={!canStartNew}>
          新对话
        </button>
      </div>
    </header>
  )
}
