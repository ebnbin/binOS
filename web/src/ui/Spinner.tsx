import { Spinner as Base } from '@radix-ui/themes'

export function Spinner({ size = '1' }: { size?: '1' | '2' | '3' }) {
  return <Base size={size} role="status" aria-label="进行中" />
}
