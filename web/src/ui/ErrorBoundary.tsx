import { Component } from 'react'
import type { ReactNode } from 'react'

// 出错时只影响这一块，可以重试
export class ErrorBoundary extends Component<{ children: ReactNode; fallback: (retry: () => void) => ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children
  }
}
