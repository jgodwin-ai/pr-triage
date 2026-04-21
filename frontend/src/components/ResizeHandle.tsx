import { useEffect, useRef } from "react";

interface Props {
  /** Called on every drag frame with the new pixel delta from drag start. */
  onDrag: (deltaX: number) => void;
  /** Called once when drag starts; use to snapshot the current width. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function ResizeHandle({ onDrag, onDragStart, onDragEnd }: Props) {
  const startX = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (startX.current == null) return;
      onDrag(e.clientX - startX.current);
    };
    const onUp = () => {
      if (startX.current == null) return;
      startX.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onDragEnd?.();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onDrag, onDragEnd]);

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        e.preventDefault();
        startX.current = e.clientX;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        onDragStart?.();
      }}
    />
  );
}
