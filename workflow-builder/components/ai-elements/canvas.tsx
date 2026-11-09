import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  type ReactFlowProps,
} from "@xyflow/react";
import type { ReactNode } from "react";
import "@xyflow/react/dist/style.css";

type CanvasProps<N extends Node, E extends Edge> = ReactFlowProps<N, E> & {
  children?: ReactNode;
};

export const Canvas = <N extends Node = Node, E extends Edge = Edge>({
  children,
  ...props
}: CanvasProps<N, E>) => {
  return (
    <ReactFlow<N, E>
      fitView
      panActivationKeyCode={null}
      selectionOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnPinch
      {...props}
    >
      <Background bgColor="var(--sidebar)" color="var(--border)" gap={24} size={2} />
      {children}
    </ReactFlow>
  );
};
