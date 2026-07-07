import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** 오류 시 표시할 라벨 (예: "3D 오피스") */
  label: string;
  fallback?: ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

/** 일부 뷰(특히 WebGL)가 죽어도 앱 전체가 내려가지 않게 격리한다. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="error-fallback">
            <strong>{this.props.label}에 문제가 생겼습니다</strong>
            <small>{this.state.error.message}</small>
            <button
              onClick={() => this.setState({ error: null })}
              type="button"
            >
              다시 시도
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
