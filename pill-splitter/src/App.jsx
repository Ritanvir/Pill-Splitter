import React, { useState, useRef, useEffect } from "react";

/*
 Pill data model:
 {
  id,
  x, y, width, height,
  color,
  borderRadiusSpec: { tl, tr, br, bl }  // numbers in px, used to form border-radius string
 }
*/

const MIN_PILL = 40;
const MIN_PART = 20;
const BORDER = 4;
let nextId = 1;

function randColor() {
  // pastel-ish color
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 20);
  const l = 55 + Math.floor(Math.random() * 8);
  return `hsl(${h} ${s}% ${l}%)`;
}

function brStr(spec) {
  // spec: {tl,tr,br,bl}
  // CSS order: top-left top-right bottom-right bottom-left
  return `${spec.tl}px ${spec.tr}px ${spec.br}px ${spec.bl}px`;
}

export default function App() {
  const [pills, setPills] = useState([]);
  const [drawing, setDrawing] = useState(null); // {startX,startY, x,y,width,height}
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // {id, offsetX, offsetY}
  const clickIgnoreRef = useRef(false);

  // global mouse move to track split lines
  useEffect(() => {
    const onMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      if (drawing) {
        const { startX, startY } = drawing;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        setDrawing({ ...drawing, x, y, width: w, height: h });
        clickIgnoreRef.current = true;
      }
      if (dragging) {
        setPills((prev) =>
          prev.map((p) =>
            p.id === dragging.id
              ? { ...p, x: mousePosAdjust(e.clientX, dragging.offsetX), y: mousePosAdjustY(e.clientY, dragging.offsetY) }
              : p
          )
        );
      }
    };

    function mousePosAdjust(clientX, offsetX) {
      // we want snapping to whole pixels
      return Math.round(clientX - offsetX);
    }
    function mousePosAdjustY(clientY, offsetY) {
      return Math.round(clientY - offsetY);
    }

    const onUp = (e) => {
      if (drawing) {
        // finalize drawing if meets min size
        const { x, y, width, height } = drawing;
        if (width >= MIN_PILL && height >= MIN_PILL) {
          const newPill = {
            id: nextId++,
            x,
            y,
            width,
            height,
            color: randColor(),
            borderRadiusSpec: { tl: 20, tr: 20, br: 20, bl: 20 },
          };
          setPills((p) => [...p, newPill]);
        }
        setDrawing(null);
      }

      setDragging(null);
      // small timeout to allow click handler to see that we just completed a draw (prevent accidental split)
      setTimeout(() => (clickIgnoreRef.current = false), 0);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, dragging]);

  // Helper intersection checks
  function intersectsVertical(p, xLine) {
    return p.x < xLine && p.x + p.width > xLine;
  }
  function intersectsHorizontal(p, yLine) {
    return p.y < yLine && p.y + p.height > yLine;
  }

  function onMouseDown(e) {
    // if clicked on empty part (not on a pill) start drawing
    if (e.target === containerRef.current) {
      setDrawing({
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        width: 0,
        height: 0,
      });
      clickIgnoreRef.current = true;
    }
  }

  function onPillMouseDown(e, pill) {
    // start dragging a pill
    e.stopPropagation();
    const offsetX = e.clientX - pill.x;
    const offsetY = e.clientY - pill.y;
    setDragging({ id: pill.id, offsetX, offsetY });
  }

  function onSingleClick(e) {
    // splitting action — only when not in the middle of drawing
    if (clickIgnoreRef.current) return;
    const xLine = mousePos.x;
    const yLine = mousePos.y;

    setPills((prev) => {
      const next = [];
      prev.forEach((p) => {
        const v = intersectsVertical(p, xLine);
        const h = intersectsHorizontal(p, yLine);

        if (!v && !h) {
          next.push(p);
          return;
        }

        // both splits -> quad-split
        if (v && h) {
          const leftW = xLine - p.x;
          const rightW = p.x + p.width - xLine;
          const topH = yLine - p.y;
          const botH = p.y + p.height - yLine;

          const canLeft = leftW >= MIN_PART;
          const canRight = rightW >= MIN_PART;
          const canTop = topH >= MIN_PART;
          const canBot = botH >= MIN_PART;

          // if both axes produce all parts >= MIN_PART → produce 4
          if (canLeft && canRight && canTop && canBot) {
            // top-left
            next.push({
              id: nextId++,
              x: p.x,
              y: p.y,
              width: leftW,
              height: topH,
              color: p.color,
              borderRadiusSpec: { tl: 20, tr: 0, br: 0, bl: 20 },
            });
            // top-right
            next.push({
              id: nextId++,
              x: xLine,
              y: p.y,
              width: rightW,
              height: topH,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 20, br: 20, bl: 0 }, // top-right corner rounded
            });
            // bottom-left
            next.push({
              id: nextId++,
              x: p.x,
              y: yLine,
              width: leftW,
              height: botH,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 0, br: 20, bl: 20 },
            });
            // bottom-right
            next.push({
              id: nextId++,
              x: xLine,
              y: yLine,
              width: rightW,
              height: botH,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 0, br: 20, bl: 0 }, // adjust for visual consistency
            });
            return;
          }
          // else fallback — do axis-by-axis splits if possible
          // try vertical split if possible
          if (canLeft && canRight) {
            const left = {
              id: nextId++,
              x: p.x,
              y: p.y,
              width: leftW,
              height: p.height,
              color: p.color,
              borderRadiusSpec: { tl: 20, tr: 0, br: 20, bl: 20 },
            };
            const right = {
              id: nextId++,
              x: xLine,
              y: p.y,
              width: rightW,
              height: p.height,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 20, br: 20, bl: 0 },
            };
            next.push(left, right);
            return;
          }
          if (canTop && canBot) {
            const top = {
              id: nextId++,
              x: p.x,
              y: p.y,
              width: p.width,
              height: topH,
              color: p.color,
              borderRadiusSpec: { tl: 20, tr: 20, br: 0, bl: 0 },
            };
            const bot = {
              id: nextId++,
              x: p.x,
              y: yLine,
              width: p.width,
              height: botH,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 0, br: 20, bl: 20 },
            };
            next.push(top, bot);
            return;
          }

          // else can't split cleanly on both → move small part to side (choose based on center)
          const centerX = p.x + p.width / 2;
          if (centerX < xLine) {
            // move entire piece left of split (so it no longer intersects)
            const shifted = { ...p, x: Math.max(0, Math.round(p.x - 10)) };
            next.push(shifted);
          } else {
            const shifted = { ...p, x: Math.round(xLine + 2) };
            next.push(shifted);
          }
          return;
        }

        // only vertical split
        if (v) {
          const leftW = xLine - p.x;
          const rightW = p.x + p.width - xLine;
          const canLeft = leftW >= MIN_PART;
          const canRight = rightW >= MIN_PART;
          if (canLeft && canRight) {
            next.push({
              id: nextId++,
              x: p.x,
              y: p.y,
              width: leftW,
              height: p.height,
              color: p.color,
              borderRadiusSpec: { tl: 20, tr: 0, br: 20, bl: 20 },
            });
            next.push({
              id: nextId++,
              x: xLine,
              y: p.y,
              width: rightW,
              height: p.height,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 20, br: 20, bl: 0 },
            });
            return;
          } else {
            // too small to split; move part to a side so it doesn't intersect
            const centerX = p.x + p.width / 2;
            if (centerX < xLine) {
              next.push({ ...p, x: Math.max(0, Math.round(p.x - 10)) });
            } else {
              next.push({ ...p, x: Math.round(xLine + 2) });
            }
            return;
          }
        }

        // only horizontal split
        if (h) {
          const topH = yLine - p.y;
          const botH = p.y + p.height - yLine;
          const canTop = topH >= MIN_PART;
          const canBot = botH >= MIN_PART;
          if (canTop && canBot) {
            next.push({
              id: nextId++,
              x: p.x,
              y: p.y,
              width: p.width,
              height: topH,
              color: p.color,
              borderRadiusSpec: { tl: 20, tr: 20, br: 0, bl: 0 },
            });
            next.push({
              id: nextId++,
              x: p.x,
              y: yLine,
              width: p.width,
              height: botH,
              color: p.color,
              borderRadiusSpec: { tl: 0, tr: 0, br: 20, bl: 20 },
            });
            return;
          } else {
            // too small
            const centerY = p.y + p.height / 2;
            if (centerY < yLine) {
              next.push({ ...p, y: Math.max(0, Math.round(p.y - 10)) });
            } else {
              next.push({ ...p, y: Math.round(yLine + 2) });
            }
            return;
          }
        }

        // fallback push original
        next.push(p);
      });
      return next;
    });
  }

  return (
    <div
      ref={containerRef}
      className="app-container"
      onMouseDown={onMouseDown}
      onClick={onSingleClick}
    >
      {/* split lines */}
      <div
        className="split-line vertical"
        style={{ left: mousePos.x - 1 }}
        aria-hidden
      />
      <div
        className="split-line horizontal"
        style={{ top: mousePos.y - 1 }}
        aria-hidden
      />

      {/* pills */}
      {pills.map((p) => (
        <div
          key={p.id}
          className="pill"
          onMouseDown={(e) => onPillMouseDown(e, p)}
          style={{
            left: p.x,
            top: p.y,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: brStr(p.borderRadiusSpec || { tl: 20, tr: 20, br: 20, bl: 20 }),
            border: `${BORDER}px solid rgba(0,0,0,0.8)`,
            position: "absolute",
            boxSizing: "border-box",
            cursor: "grab",
            userSelect: "none",
            zIndex: dragging && dragging.id === p.id ? 999 : 10,
          }}
        />
      ))}

      {/* drawing preview */}
      {drawing && (
        <div
          className="drawing-preview"
          style={{
            left: drawing.x,
            top: drawing.y,
            width: drawing.width,
            height: drawing.height,
            borderRadius: 20,
            border: `${BORDER}px dashed rgba(0,0,0,0.6)`,
            position: "absolute",
            pointerEvents: "none",
            background: "transparent",
            zIndex: 1000,
          }}
        />
      )}

      {/* controls / help */}
      <div className="info">
        <strong>Pill Splitter</strong> — Click & drag on empty space to draw a pill (min 40×40).
        Move pills by dragging. Single click splits pills that intersect the crosshair lines.
      </div>
    </div>
  );
}
