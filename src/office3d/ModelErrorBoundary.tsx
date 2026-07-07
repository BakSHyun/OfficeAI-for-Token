import { Component, type ReactNode } from "react";
import type { Character } from "./character-machine";
import { PrimitiveCat } from "./PrimitiveCat";

type ModelErrorBoundaryProps = {
  character: Character;
  children: ReactNode;
};

type ModelErrorBoundaryState = { failed: boolean };

/** glTF 로드 실패 시 프리미티브 고양이로 폴백 */
export class ModelErrorBoundary extends Component<
  ModelErrorBoundaryProps,
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <PrimitiveCat character={this.props.character} />;
    }
    return this.props.children;
  }
}
