import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Breadcrumbs from "../../src/components/Breadcrumbs.js";

describe("Breadcrumbs", () => {
  it("renders all crumbs with arrow separators", () => {
    const crumbs = [
      { label: "Home", onClick: vi.fn() },
      { label: "Section", onClick: vi.fn() },
      { label: "Page" },
    ];
    const { container } = render(<Breadcrumbs crumbs={crumbs} />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Section")).toBeTruthy();
    expect(screen.getByText("Page")).toBeTruthy();
    // Arrow separators between crumbs
    expect(container.textContent).toContain("→");
  });

  it("renders clickable crumbs as buttons", () => {
    const onClick = vi.fn();
    const crumbs = [{ label: "Home", onClick }];
    render(<Breadcrumbs crumbs={crumbs} />);
    const button = screen.getByRole("button", { name: "Home" });
    expect(button.tagName).toBe("BUTTON");
  });

  it("renders non-clickable crumbs as bold text with aria-current", () => {
    const crumbs = [{ label: "Current Page" }];
    render(<Breadcrumbs crumbs={crumbs} />);
    const element = screen.getByText("Current Page");
    expect(element.tagName).toBe("STRONG");
    expect(element.getAttribute("aria-current")).toBe("page");
  });

  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn();
    const crumbs = [{ label: "Home", onClick }];
    render(<Breadcrumbs crumbs={crumbs} />);
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has aria-label="Breadcrumb" on nav', () => {
    const crumbs = [{ label: "Home" }];
    render(<Breadcrumbs crumbs={crumbs} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeTruthy();
  });
});
