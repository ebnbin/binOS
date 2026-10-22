import '@material/web/progress/circular-progress.js'
export function Spinner() {
  return <md-circular-progress indeterminate aria-label="进行中" style={{ width: 24, height: 24 }} />
}
