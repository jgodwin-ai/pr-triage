import { useEffect, useState } from "react";

export default function ScrollHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
      const hasRoom = document.body.scrollHeight > window.innerHeight + 40;
      setVisible(hasRoom && !atBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const t = setInterval(onScroll, 1000); // catch content changes (accordion expand)
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearInterval(t);
    };
  }, []);

  if (!visible) return null;
  return (
    <button
      className="scroll-hint"
      type="button"
      aria-label="Scroll to review form"
      onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
    >
      <span className="scroll-hint__chevron">▾</span>
      <span className="scroll-hint__label">Review form</span>
    </button>
  );
}
