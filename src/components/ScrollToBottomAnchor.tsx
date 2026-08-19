"use client";

import { useEffect, useRef } from "react";

// Placed as the last child of the scrollable message list. On mount (i.e.
// when the channel is first opened, not on every 8s poll refresh - React
// keeps this same instance across those) it scrolls itself into view so the
// list opens showing the newest messages instead of the oldest.
export default function ScrollToBottomAnchor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, []);

  return <div ref={ref} />;
}
