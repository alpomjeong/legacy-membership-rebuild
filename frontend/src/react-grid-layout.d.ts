declare module "react-grid-layout" {
  import * as React from "react";
  export interface Layout {
    i: string; x: number; y: number; w: number; h: number;
    minW?: number; minH?: number; maxW?: number; maxH?: number; static?: boolean;
  }
  export interface ReactGridLayoutProps {
    className?: string;
    layout?: Layout[];
    cols?: number;
    rowHeight?: number;
    margin?: [number, number];
    draggableHandle?: string;
    draggableCancel?: string;
    isBounded?: boolean;
    onLayoutChange?: (layout: Layout[]) => void;
    resizeHandles?: Array<"s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne">;
    width?: number;
    isDroppable?: boolean;
    droppingItem?: { i: string; w: number; h: number };
    onDrop?: (layout: Layout[], item: Layout | null, e: DragEvent) => void;
    children?: React.ReactNode;
  }
  const GridLayout: React.ComponentType<ReactGridLayoutProps>;
  export function WidthProvider<P extends { width?: number }>(
    c: React.ComponentType<P>,
  ): React.ComponentType<Omit<P, "width">>;
  export default GridLayout;
}
declare module "react-grid-layout/css/styles.css";
declare module "react-resizable/css/styles.css";
