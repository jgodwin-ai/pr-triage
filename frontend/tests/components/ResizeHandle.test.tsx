import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import ResizeHandle from "../../src/components/ResizeHandle.js";

describe("ResizeHandle", () => {
  it("renders a separator element", () => {
    const { container } = render(
      <ResizeHandle onDrag={vi.fn()} />
    );
    const el = container.querySelector(".resize-handle");
    expect(el).toBeTruthy();
    expect(el?.getAttribute("role")).toBe("separator");
  });

  it("calls onDragStart on mousedown", () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <ResizeHandle onDrag={vi.fn()} onDragStart={onDragStart} />
    );
    const el = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(el, { clientX: 100 });
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("calls onDrag with delta on mousemove after mousedown", () => {
    const onDrag = vi.fn();
    const { container } = render(
      <ResizeHandle onDrag={onDrag} />
    );
    const el = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(el, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 150 });
    expect(onDrag).toHaveBeenCalledWith(50);
  });

  it("does not call onDrag before mousedown", () => {
    const onDrag = vi.fn();
    render(<ResizeHandle onDrag={onDrag} />);
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(onDrag).not.toHaveBeenCalled();
  });

  it("calls onDragEnd on mouseup and stops tracking", () => {
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();
    const { container } = render(
      <ResizeHandle onDrag={onDrag} onDragEnd={onDragEnd} />
    );
    const el = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(el, { clientX: 100 });
    fireEvent.mouseUp(window);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
    // subsequent mousemove should not trigger onDrag
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(onDrag).not.toHaveBeenCalled();
  });
});
