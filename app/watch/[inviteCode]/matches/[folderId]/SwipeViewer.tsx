"use client";

import { useRef, useState } from "react";

export default function SwipeViewer({
  videoUrls,
}: {
  videoUrls: string[];
}) {
  const [index, setIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const touchStartX = useRef<number | null>(null);

  function goTo(next: number) {
    if (next < 0 || next >= videoUrls.length) return;
    setIndex(next);
    setShowGrid(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    const SWIPE_THRESHOLD = 50;
    if (deltaX > SWIPE_THRESHOLD) goTo(index - 1);
    else if (deltaX < -SWIPE_THRESHOLD) goTo(index + 1);
  }

  if (showGrid) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">動画一覧（{videoUrls.length}本）</p>
          <button
            onClick={() => setShowGrid(false)}
            className="text-sm text-slate-500 underline"
          >
            再生画面に戻る
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {videoUrls.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`flex aspect-square items-center justify-center rounded-md border text-sm ${
                i === index
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative"
      >
        <video
          key={videoUrls[index]}
          controls
          playsInline
          autoPlay
          className="w-full rounded-lg bg-black"
          src={videoUrls[index]}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-30"
        >
          ← 前
        </button>
        <button
          onClick={() => setShowGrid(true)}
          className="text-sm text-slate-500 underline"
        >
          {index + 1} / {videoUrls.length}（一覧を見る）
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === videoUrls.length - 1}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-30"
        >
          次 →
        </button>
      </div>
    </div>
  );
}
