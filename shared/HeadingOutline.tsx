"use client";
import { useEffect, useState } from "react";
export default function HeadingOutline({
  items,
  editor = false,
}: {
  items: { id: string; title: string; level: number }[];
  editor?: boolean;
}) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let next = items[0]?.id;
      for (const item of items) {
        const el =
          document.getElementById(item.id) ||
          (editor
            ? document.querySelector(`[data-id="${CSS.escape(item.id)}"]`)
            : null);
        if (el && el.getBoundingClientRect().top <= 130) next = item.id;
      }
      setActive(next);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items, editor]);
  if (!items.length) return null;
  return (
    <nav className="outline" aria-label="On this page">
      <span className="eyebrow">On this page</span>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={active === item.id ? "location" : undefined}
          style={{ paddingLeft: `${Math.max(0, item.level - 2) * 12}px` }}
          onClick={(event) => {
            if (editor) {
              event.preventDefault();
              const el = document.querySelector(
                `[data-id="${CSS.escape(item.id)}"]`,
              );
              el?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
              setActive(item.id);
            }
          }}
        >
          {item.title}
        </a>
      ))}
    </nav>
  );
}
