import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnnotationFilterBar from "../../src/components/AnnotationFilterBar.js";

describe("AnnotationFilterBar", () => {
  it("toggles a type when clicked", () => {
    const onChange = vi.fn();
    render(<AnnotationFilterBar value={{ warning: true, info: true, suggestion: true }} onChange={onChange} />);
    fireEvent.click(screen.getByText(/info/i));
    expect(onChange).toHaveBeenCalledWith({ warning: true, info: false, suggestion: true });
  });

  it("renders active chips with is-active class when true", () => {
    const { container } = render(
      <AnnotationFilterBar value={{ warning: true, info: false, suggestion: true }} onChange={() => {}} />,
    );
    const chips = container.querySelectorAll(".chip");
    const active = Array.from(chips).filter((c) => c.className.includes("is-active"));
    expect(active).toHaveLength(2);
  });
});
