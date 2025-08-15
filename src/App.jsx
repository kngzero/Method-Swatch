import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Download,
  Copy,
  RefreshCcw,
  Lock,
  Unlock as LockOpen,
  Settings,
} from "lucide-react";
import logo from "../logo.svg";

/**
 * Method Swatch – App.jsx (patched)
 * - White background / black UI
 * - Fixed lucide-react imports (no `Images`)
 * - Removed missing import (`mergeCloseColors.js`) and inlined helpers
 * - Works with Vite + Tailwind
 */

/* ---------- Utility Functions ---------- */
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return { h, s, v };
}

function distanceSq(a, b) {
  const dr = a.r - b.r; const dg = a.g - b.g; const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function nearestCentroidIndex(p, centroids) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = distanceSq(p, centroids[i]);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function arrayShuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Merge near-duplicate colors by Euclidean distance threshold in RGB space */
function mergeCloseColors(colors, threshold = 18) {
  if (!colors || colors.length === 0) return colors;
  const out = [];
  const used = new Array(colors.length).fill(false);
  for (let i = 0; i < colors.length; i++) {
    if (used[i]) continue;
    let base = { ...colors[i] };
    let totalCount = base.count || 1;
    used[i] = true;
    for (let j = i + 1; j < colors.length; j++) {
      if (used[j]) continue;
      const d = Math.sqrt(distanceSq(base, colors[j]));
      if (d <= threshold) {
        const c = colors[j];
        const w = (c.count || 1);
        base = {
          r: Math.round((base.r * totalCount + c.r * w) / (totalCount + w)),
          g: Math.round((base.g * totalCount + c.g * w) / (totalCount + w)),
          b: Math.round((base.b * totalCount + c.b * w) / (totalCount + w)),
          count: totalCount + w,
          locked: base.locked || c.locked,
        };
        used[j] = true;
        totalCount += w;
      }
    }
    out.push(base);
  }
  return out;
}

/* ---------- K-Means Quantization ---------- */
function kmeansQuantize({ pixels, k, maxIters = 10, locked = [], ignoreNeutrals = false }) {
  if (!pixels || pixels.length === 0) return [];

  const filtered = ignoreNeutrals
    ? pixels.filter((p) => rgbToHsv(p.r, p.g, p.b).s >= 0.1)
    : pixels;
  const pts = filtered.length > 0 ? filtered : pixels;

  const MAX = 20000;
  let pool = pts;
  if (pts.length > MAX) {
    const step = Math.floor(pts.length / MAX);
    pool = pts.filter((_, idx) => idx % step === 0);
  }

  const centroids = [];
  const lockedRGB = locked
    .filter((c) => c && c.hex)
    .map((c) => ({ ...hexToRgb(c.hex), locked: true }));
  for (const c of lockedRGB) centroids.push({ ...c });

  const need = Math.max(0, k - centroids.length);
  const shuffled = arrayShuffleInPlace(pool.slice());
  for (let i = 0; i < need; i++) {
    const p = shuffled[i % shuffled.length];
    centroids.push({ r: p.r, g: p.g, b: p.b, locked: false });
  }
  if (centroids.length === 0) {
    const first = pool[0];
    centroids.push({ r: first.r, g: first.g, b: first.b, locked: false });
  }

  for (let iter = 0; iter < maxIters; iter++) {
    const assignments = new Array(pool.length);
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, w: 0 }));

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      const idx = nearestCentroidIndex(p, centroids);
      assignments[i] = idx;
      sums[idx].r += p.r;
      sums[idx].g += p.g;
      sums[idx].b += p.b;
      sums[idx].w += 1;
    }

    let anyMoved = false;
    for (let c = 0; c < centroids.length; c++) {
      if (centroids[c].locked) continue;
      if (sums[c].w > 0) {
        const nr = Math.round(sums[c].r / sums[c].w);
        const ng = Math.round(sums[c].g / sums[c].w);
        const nb = Math.round(sums[c].b / sums[c].w);
        if (nr !== centroids[c].r || ng !== centroids[c].g || nb !== centroids[c].b) {
          centroids[c] = { ...centroids[c], r: nr, g: ng, b: nb };
          anyMoved = true;
        }
      } else {
        const rp = pool[Math.floor(Math.random() * pool.length)];
        centroids[c] = { ...centroids[c], r: rp.r, g: rp.g, b: rp.b };
        anyMoved = true;
      }
    }
    if (!anyMoved) break;
  }

  const counts = centroids.map(() => 0);
  for (const p of pixels) {
    const idx = nearestCentroidIndex(p, centroids);
    counts[idx]++;
  }

  return centroids.map((c, i) => ({ ...c, count: counts[i] }));
}

function rankPalette(colors, mode = "Dominant") {
  const arr = colors.slice();
  if (mode === "Vibrant") {
    return arr.sort((a, b) => {
      const ahsv = rgbToHsv(a.r, a.g, a.b);
      const bhsv = rgbToHsv(b.r, b.g, b.b);
      const ascore = ahsv.s * ahsv.v;
      const bscore = bhsv.s * bhsv.v;
      if (bscore !== ascore) return bscore - ascore;
      return (b.count || 0) - (a.count || 0);
    });
  }
  if (mode === "Unique") {
    const uniqScore = (c, others) => {
      let minD = Infinity;
      for (const o of others) {
        if (o === c) continue;
        const d = Math.sqrt(distanceSq(c, o));
        minD = Math.min(minD, d);
      }
      return minD * Math.log((c.count || 1) + 1);
    };
    return arr.sort((a, b) => uniqScore(b, arr) - uniqScore(a, arr));
  }
  return arr.sort((a, b) => (b.count || 0) - (a.count || 0));
}

/* Draw a simple PNG palette sheet on white */
async function drawPalettePNG(colors, options = {}) {
  const {
    title = "Method Swatch",
    subtitle = new Date().toLocaleString(),
    swatchWidth = 180,
    swatchHeight = 160,
    padding = 40,
    columns = 6,
  } = options;

  const rows = Math.ceil(colors.length / columns);
  const width = padding * 2 + columns * swatchWidth + (columns - 1) * 16;
  const height = padding * 2 + rows * swatchHeight + (rows - 1) * 16 + 90;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111111";
  ctx.font = "600 28px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(title, padding, padding + 8);
  ctx.font = "400 16px Inter, system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillStyle = "#555555";
  ctx.fillText(subtitle, padding, padding + 36);

  let x = padding, y = padding + 64;
  let col = 0;
  colors.forEach((c) => {
    const hex = rgbToHex(c.r, c.g, c.b);
    ctx.fillStyle = hex;
    ctx.fillRect(x, y, swatchWidth, swatchHeight - 40);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y + swatchHeight - 40, swatchWidth, 40);

    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(x, y + swatchHeight - 40);
    ctx.lineTo(x + swatchWidth, y + swatchHeight - 40);
    ctx.stroke();

    ctx.fillStyle = "#111111";
    ctx.font = "500 16px Inter, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(hex, x + 12, y + swatchHeight - 16);

    col++;
    if (col >= columns) { col = 0; x = padding; y += swatchHeight + 16; }
    else { x += swatchWidth + 16; }
  });

  return canvas.toDataURL("image/png");
}

/* Extract pixels from images (downsampled for performance) */
async function extractPixelsFromFiles(files, targetMaxDim = 400, step = 2) {
  const pixels = [];

  const loadImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  for (const f of files) {
    const img = await loadImage(f);
    const { width, height } = img;
    const scale = Math.min(1, targetMaxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    try {
      const data = ctx.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 10) pixels.push({ r, g, b });
        }
      }
    } catch (e) {
      console.error("Failed to read pixels for", f.name, e);
    } finally {
      URL.revokeObjectURL(img.src);
    }
  }

  return pixels;
}

/* ---------- Main App ---------- */
export default function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [pixels, setPixels] = useState([]);
  const [palette, setPalette] = useState([]);
  const [numColors, setNumColors] = useState(8);
  const [mode, setMode] = useState("Dominant");
  const [ignoreNeutrals, setIgnoreNeutrals] = useState(false);
  const [mergeThreshold, setMergeThreshold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState(null);

  const dropRef = useRef(null);

  const hasImages = files.length > 0;
  const hasPalette = palette.length > 0;

  /* Handle file selection + previews */
  const handleFiles = useCallback(async (fileList) => {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;
    setError("");
    setBusy(true);
    try {
      setFiles(arr);
      const thumbs = arr.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
      setPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return thumbs;
      });
      const px = await extractPixelsFromFiles(arr);
      setPixels(px);
    } catch (e) {
      console.error(e);
      setError("Failed to process images.");
    } finally {
      setBusy(false);
    }
  }, []);

  /* Drag & drop + paste handlers */
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;

    const onDragOver = (e) => { e.preventDefault(); el.classList.add("ring-2", "ring-black/30"); };
    const onDragLeave = () => { el.classList.remove("ring-2", "ring-black/30"); };
    const onDrop = (e) => {
      e.preventDefault();
      el.classList.remove("ring-2", "ring-black/30");
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    };
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
      if (files.length) handleFiles(files);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    el.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("paste", onPaste);
    };
  }, [handleFiles]);

  /* Generate / regenerate palette */
  const generatePalette = useCallback(async () => {
    if (!pixels.length) return;
    setBusy(true);
    try {
      const locked = palette.filter((c) => c.locked).map((c) => ({ hex: rgbToHex(c.r, c.g, c.b) }));
      let result = kmeansQuantize({ pixels, k: numColors, locked, ignoreNeutrals });
      if (mergeThreshold > 0) {
        result = mergeCloseColors(result, mergeThreshold);
        if (result.length < numColors) {
          const need = numColors - result.length;
          const locked2 = result.map((c) => ({ hex: rgbToHex(c.r, c.g, c.b) }));
          const refill = kmeansQuantize({ pixels, k: result.length + need, locked: locked2, ignoreNeutrals });
          result = refill;
        }
      }
      result = rankPalette(result.slice(0, numColors), mode).map((c) => ({ ...c, locked: false }));
      const hexLocked = new Set(locked.map((l) => l.hex));
      result = result.map((c) => ({ ...c, locked: hexLocked.has(rgbToHex(c.r, c.g, c.b)) }));
      setPalette(result);
    } catch (e) {
      console.error(e);
      setError("Palette generation failed.");
    } finally {
      setBusy(false);
    }
  }, [pixels, numColors, mode, ignoreNeutrals, mergeThreshold, palette]);

  /* Clear everything */
  const clearAll = useCallback(() => {
    setFiles([]);
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setPixels([]);
    setPalette([]);
    setError("");
  }, [previews]);

  /* Swatch handlers */
  const toggleLock = (idx) => {
    setPalette((prev) => prev.map((c, i) => (i === idx ? { ...c, locked: !c.locked } : c)));
  };

  const onDragStart = (idx) => setDragIndex(idx);
  const onDragOverSwatch = (e, overIdx) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === overIdx) return;
    setPalette((prev) => {
      const arr = prev.slice();
      const [moved] = arr.splice(dragIndex, 1);
      arr.splice(overIdx, 0, moved);
      setDragIndex(overIdx);
      return arr;
    });
  };
  const onDropSwatch = () => setDragIndex(null);

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch (e) { console.error("Copy failed", e); }
  };

  const exportJSON = () => {
    const data = palette.map((c, i) => ({ name: `swatch_${i + 1}`, hex: rgbToHex(c.r, c.g, c.b), rgb: { r: c.r, g: c.g, b: c.b } }));
    const blob = new Blob([JSON.stringify({ name: "Method Swatch Palette", colors: data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "method-swatch-palette.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSS = () => {
    const lines = [":root {"];
    palette.forEach((c, i) => lines.push(`  --swatch-${i + 1}: ${rgbToHex(c.r, c.g, c.b)};`));
    lines.push("}");
    const css = lines.join("\n");
    const blob = new Blob([css], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "method-swatch.css";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = async () => {
    const dataUrl = await drawPalettePNG(palette);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "method-swatch.png";
    a.click();
  };

  const removeImage = (name) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreviews((prev) => {
      const target = prev.find((p) => p.name === name);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.name !== name);
    });
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-10 backdrop-blur border-b border-black/10 bg-white/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Method Swatch logo" className="h-9 w-9" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Method Swatch</h1>
              <p className="text-xs text-black/60 -mt-0.5">Extract refined color palettes from your images</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-sm inline-flex items-center gap-2"
              title="Reset"
            >
              <Trash2 className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={generatePalette}
              disabled={!pixels.length || busy}
              className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:bg-black/20 disabled:text-black/40 text-sm font-medium inline-flex items-center gap-2"
              title="Generate Palette"
            >
              <RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Generate
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + Settings */}
        <section className="lg:col-span-1 space-y-6">
          <div
            ref={dropRef}
            className="border border-dashed border-black/20 rounded-2xl p-5 bg-white hover:bg-black/5 transition-colors"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-2xl border border-black/10 grid place-items-center">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Drag & drop images here</p>
                <p className="text-xs text-black/60">or click to browse • paste works too (⌘/Ctrl+V)</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-sm">
                  <ImageIcon className="h-4 w-4" /> Choose images
                </span>
              </label>
            </div>
          </div>

          {/* Thumbnails */}
          {previews.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-black/10">
              <p className="text-xs uppercase tracking-wider text-black/60 mb-3">Selected images</p>
              <div className="grid grid-cols-3 gap-3">
                {previews.map((p) => (
                  <div key={p.name} className="relative group rounded-xl overflow-hidden border border-black/10">
                    <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
                    <button
                      onClick={() => removeImage(p.name)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs border border-black/10"
                    >Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="bg-white rounded-2xl p-4 space-y-4 border border-black/10">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <p className="text-sm font-medium">Extraction Settings</p>
            </div>
            <div>
              <label className="text-xs text-black/60">Number of colors: <span className="text-black font-medium">{numColors}</span></label>
              <input type="range" min={3} max={20} value={numColors} onChange={(e) => setNumColors(parseInt(e.target.value))} className="w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Dominant','Vibrant','Unique'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-2 rounded-xl text-sm border ${mode === m ? 'border-black bg-black text-white' : 'border-black/10 hover:bg-black/5'}`}
                >{m}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input id="neutrals" type="checkbox" checked={ignoreNeutrals} onChange={(e) => setIgnoreNeutrals(e.target.checked)} />
              <label htmlFor="neutrals" className="text-sm">Ignore near-neutrals</label>
            </div>
            <div>
              <label className="text-xs text-black/60">Merge similar shades (0–40): <span className="text-black font-medium">{mergeThreshold}</span></label>
              <input type="range" min={0} max={40} value={mergeThreshold} onChange={(e) => setMergeThreshold(parseInt(e.target.value))} className="w-full" />
            </div>
          </div>

          {/* Exports */}
          <div className="bg-white rounded-2xl p-4 space-y-3 border border-black/10">
            <p className="text-xs uppercase tracking-wider text-black/60">Exports</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={exportJSON} disabled={!hasPalette} className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-50 text-sm inline-flex items-center justify-center gap-2"><Download className="h-4 w-4"/> JSON</button>
              <button onClick={exportCSS} disabled={!hasPalette} className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-50 text-sm inline-flex items-center justify-center gap-2"><Download className="h-4 w-4"/> CSS</button>
              <button onClick={exportPNG} disabled={!hasPalette} className="px-3 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-50 text-sm inline-flex items-center justify-center gap-2"><Download className="h-4 w-4"/> PNG</button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-3 text-sm">{error}</div>
          )}
        </section>

        {/* Right: Palette */}
        <section className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-4 min-h-[420px] border border-black/10">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wider text-black/60">Palette</p>
              <div className="text-xs text-black/60">{busy ? 'Processing…' : hasPalette ? `${palette.length} swatches` : 'No palette yet'}</div>
            </div>

            {!hasPalette && (
              <div className="h-[360px] grid place-items-center text-black/60 text-sm">
                {hasImages ? (
                  <div className="text-center">
                    <p className="mb-1">Images loaded. Ready to extract.</p>
                    <button onClick={generatePalette} className="mt-2 px-3 py-2 rounded-xl bg-black text-white text-sm font-medium inline-flex items-center gap-2"><RefreshCcw className="h-4 w-4"/> Generate palette</button>
                  </div>
                ) : (
                  <div className="text-center opacity-70">
                    <ImageIcon className="h-8 w-8 mx-auto mb-3"/>
                    <p>Upload images to begin.</p>
                  </div>
                )}
              </div>
            )}

            {hasPalette && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <AnimatePresence>
                  {palette.map((c, idx) => {
                    const hex = rgbToHex(c.r, c.g, c.b);
                    return (
                      <motion.div
                        key={`${hex}-${idx}`}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        draggable
                        onDragStart={() => onDragStart(idx)}
                        onDragOver={(e) => onDragOverSwatch(e, idx)}
                        onDrop={onDropSwatch}
                        className="rounded-2xl overflow-hidden border border-black/10"
                        title={hex}
                      >
                        <div className="h-28" style={{ backgroundColor: hex }} />
                        <div className="p-2 bg-white flex items-center justify-between border-t border-black/10">
                          <div className="text-xs font-mono">{hex}</div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => copyText(hex)} className="p-1 rounded-lg hover:bg-black/5" title="Copy HEX"><Copy className="h-3.5 w-3.5"/></button>
                            <button onClick={() => toggleLock(idx)} className={`p-1 rounded-lg hover:bg-black/5 ${c.locked ? 'text-amber-600' : ''}`} title={c.locked ? 'Unlock' : 'Lock'}>
                              {c.locked ? <Lock className="h-3.5 w-3.5"/> : <LockOpen className="h-3.5 w-3.5"/>}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-black/60">
        <div className="mt-4 border-t border-black/10 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Method Lab — Method Swatch</div>
          <div className="opacity-80">MVP · Drag to reorder · Click lock to preserve during regeneration</div>
        </div>
      </footer>
    </div>
  );
}
