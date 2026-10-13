// "Download image" (the owner's decision 7): the chart on screen as a PNG file, made in the browser, with no request.
// On white, top to bottom: the title, the subtitle and the key, then the chart with the lines drawn above and under
// it, and the credit at the bottom right. The chart is its live <svg>, cloned at rest (no hover, focus, tap or glide)
// with every element's computed paint and text styles written on it, and drawn as an image at its own width and in its
// own layout; the text and the key's swatches are drawn with the canvas's 2D API in the fonts and colors the page uses
// for them, read from their computed styles. Always 2× pixels. Loaded when the button is first hovered, focused or
// pressed (DownloadPng.jsx).

import { LEADING, MARK, TEXT } from "./tokens.js";

export const CREDIT = "Chart by Nathan Nguyen, @NathanDNguyen";
export const SCALE = 2;
export const PAD = 24; // CSS px around everything
const KEY = { col: 18, row: 6, swatch: 7 }; // the legend's gaps (styles.css)
/** The image's white: the page's paper color (styles.css's --paper). */
const paper = () => getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#fff";

// The paint and text properties written on the clone: an <svg> drawn as an image sees no style sheet.
const PAINT = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "opacity",
  "paint-order",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "font-variant-numeric",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "transform",
];
const STATES = ["has-active", "active", "gliding"]; // hover, focus, a tap and a glide

const shown = (el) => getComputedStyle(el).display !== "none";
const words = (el) => el.textContent.replace(/\s+/g, " ").trim();

/** The lines drawn above and under the plot: the chart's own paragraphs before and after its frame. */
function chartLines(chart) {
  const frame = chart.querySelector(".chart-frame");
  const lines = [...chart.children].filter((el) => el.tagName === "P" && shown(el) && words(el));
  const above = (el) => Boolean(frame && el.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING);
  return { above: lines.filter(above), below: lines.filter((el) => !above(el)) };
}

/**
 * The key's entries as the page shows them (one the page hides, such as the dashed line's on phones, is left out):
 * each its swatches and its words, without "(how this is decided)", since a link means nothing in an image.
 */
export function keyItems(legend) {
  if (!legend) return [];
  return [...legend.children].filter(shown).map((li) => {
    const copy = li.cloneNode(true);
    copy.querySelectorAll("a").forEach((a) => a.remove());
    const text = copy.textContent.replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
    return { li, swatches: [...li.querySelectorAll(".key")].filter(shown), text };
  });
}

/**
 * What the image says, top to bottom, without drawing it: the title and subtitle lines, the key (each entry's words
 * and its swatches' classes), the lines above and under the plot, and the credit. `spec` is what the page's button
 * gives: { title, subtitle, chart (the chart's element), legend, fileName }.
 */
export function imagePlan({ title, subtitle, chart, legend }) {
  const { above, below } = chartLines(chart);
  return {
    title: title.filter(Boolean),
    subtitle: subtitle.filter(Boolean),
    key: keyItems(legend).map(({ text, swatches }) => ({
      text,
      swatches: swatches.map((el) => [...el.classList].filter((c) => c !== "key").join(" ")),
    })),
    above: above.map(words),
    below: below.map(words),
    credit: CREDIT,
  };
}

// ------------------------------------------------------------------------------------------------------------ text
function textStyle(el) {
  const cs = getComputedStyle(el);
  const size = parseFloat(cs.fontSize);
  return {
    font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    color: cs.color,
    size,
    lineHeight: cs.lineHeight === "normal" ? size * 1.2 : parseFloat(cs.lineHeight),
    letterSpacing: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing,
    marginTop: parseFloat(cs.marginTop) || 0,
    marginBottom: parseFloat(cs.marginBottom) || 0,
  };
}

/** The style the page gives an element of this class, here: the element itself, or a hidden stand-in in `panel`. */
function styleOf(panel, el, tag, className) {
  if (el) return textStyle(el);
  const probe = document.createElement(tag);
  probe.className = className;
  probe.textContent = "x";
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;left:0;top:0;visibility:hidden;pointer-events:none";
  panel.appendChild(probe);
  const style = textStyle(probe);
  probe.remove();
  return style;
}

function setFont(ctx, style) {
  ctx.font = style.font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing;
}

/** Lines of `text` that fit `width` in the context's font, broken at spaces. */
function wrap(ctx, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Lines of text from `y` (the top of the first line box), each centered in its line box as CSS does. */
function drawLines(ctx, { lines, style, x, y, align = "left" }) {
  setFont(ctx, style);
  ctx.fillStyle = style.color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, i) => {
    const m = ctx.measureText(line);
    const ascent = m.fontBoundingBoxAscent ?? style.size * 0.8;
    const descent = m.fontBoundingBoxDescent ?? style.size * 0.2;
    ctx.fillText(line, x, y + i * style.lineHeight + (style.lineHeight - ascent - descent) / 2 + ascent);
  });
}

// ------------------------------------------------------------------------------------------------------------ the key
/** A CSS length ("6px", "50%", "calc(100% - 6px)") against `ref` px. */
function length(text, ref) {
  const t = text.trim();
  if (t === "auto" || t === "") return ref;
  const calc = t.match(/^calc\((.*)\)$/);
  if (calc) {
    let total = 0;
    let sign = 1;
    for (const part of calc[1].split(/\s+/)) {
      if (part === "+") sign = 1;
      else if (part === "-") sign = -1;
      else total += sign * length(part, ref);
    }
    return total;
  }
  return t.endsWith("%") ? (parseFloat(t) / 100) * ref : parseFloat(t) || 0;
}

/** The top-level comma-separated parts of a CSS value (commas inside parentheses stay). */
function layers(value) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "(") depth += 1;
    else if (value[i] === ")") depth -= 1;
    else if (value[i] === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

/** A gradient's color stops: [{ color, at (px or null) }]; a stop with two positions ("#fff 0 3px") is two stops. */
function stops(args) {
  const out = [];
  for (const arg of args) {
    const m = arg.match(/^(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]+|transparent)\s*(.*)$/i);
    if (!m) continue;
    const at = m[2].split(/\s+/).filter(Boolean).map(parseFloat);
    if (!at.length) out.push({ color: m[1], at: null });
    for (const p of at) out.push({ color: m[1], at: p });
  }
  return out;
}

const opaque = (color) => !/^transparent$|rgba\([^)]*,\s*0\)$/.test(color);

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** One background layer of a swatch: a solid color (a one-color linear gradient), stripes, or a dot. */
function paintLayer(ctx, layer, size, position, x, y, w, h) {
  const fn = layer.match(/^([a-z-]+)\((.*)\)$/s);
  if (!fn) return;
  const [, name, body] = fn;
  const args = layers(body);
  const [sw = w, sh = h] = size === "auto" ? [w, h] : size.split(/\s+(?![^(]*\))/).map((s, i) => length(s, i ? h : w));
  const [px, py] = position.split(/\s+(?![^(]*\))/).map((p, i) => length(p, i ? h - sh : w - sw));
  if (name === "linear-gradient") {
    const colors = stops(args);
    if (colors.length && colors.every((c) => c.color === colors[0].color)) {
      ctx.fillStyle = colors[0].color;
      ctx.fillRect(x + px, y + py, sw, sh);
    }
  } else if (name === "repeating-linear-gradient") {
    const angle = /deg$/.test(args[0]) ? parseFloat(args[0]) : 180;
    const bands = stops(args);
    const period = bands[bands.length - 1].at || 1;
    const a = (angle * Math.PI) / 180;
    const span = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    ctx.save();
    ctx.translate(x + w / 2 - (Math.sin(a) * span) / 2, y + h / 2 + (Math.cos(a) * span) / 2);
    ctx.rotate(a - Math.PI / 2);
    for (let k = 0; k * period < span + period; k += 1) {
      for (let b = 0; b < bands.length - 1; b += 1) {
        const from = bands[b].at ?? 0;
        const to = bands[b + 1].at ?? period;
        if (bands[b].color !== bands[b + 1].color || to <= from) continue;
        ctx.fillStyle = bands[b].color;
        ctx.fillRect(k * period + from, -span, to - from, 2 * span);
      }
    }
    ctx.restore();
  } else if (name === "radial-gradient") {
    const at = args[0].match(/at (.+)$/);
    const [cx, cy] = at ? at[1].split(/\s+(?![^(]*\))/).map((p, i) => length(p, i ? h : w)) : [w / 2, h / 2];
    const dot = stops(args.slice(1)).filter((s) => opaque(s.color));
    if (!dot.length) return;
    ctx.fillStyle = dot[0].color;
    ctx.beginPath();
    ctx.arc(x + cx, y + cy, Math.max(...dot.map((s) => s.at ?? 0)), 0, 2 * Math.PI);
    ctx.fill();
  }
}

/**
 * A key's swatch, from the live swatch's computed style: its background color and image layers (solid, stripes, a
 * dot), its border (all round, or single sides such as the dashed line's) and its rounded corners.
 */
function drawSwatch(ctx, { el, x, y, w, h }) {
  const cs = getComputedStyle(el);
  const radius = length(cs.borderTopLeftRadius.split(" ")[0], Math.min(w, h));
  ctx.save();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (opaque(cs.backgroundColor)) {
    ctx.fillStyle = cs.backgroundColor;
    ctx.fillRect(x, y, w, h);
  }
  if (cs.backgroundImage && cs.backgroundImage !== "none") {
    const images = layers(cs.backgroundImage);
    const sizes = layers(cs.backgroundSize);
    const positions = layers(cs.backgroundPosition);
    for (let i = images.length - 1; i >= 0; i -= 1) {
      paintLayer(ctx, images[i], sizes[i % sizes.length], positions[i % positions.length], x, y, w, h);
    }
  }
  ctx.restore();
  const sides = ["Top", "Right", "Bottom", "Left"].map((s) => ({
    side: s,
    width: parseFloat(cs[`border${s}Width`]) || 0,
    style: cs[`border${s}Style`],
    color: cs[`border${s}Color`],
  }));
  const drawn = sides.filter((s) => s.width > 0 && s.style !== "none" && s.style !== "hidden");
  if (!drawn.length) return;
  const dash = (s) => (s.style === "dashed" ? [3 * s.width, 2 * s.width] : []);
  const [first] = drawn;
  const like = (s) => s.width === first.width && s.color === first.color && s.style === first.style;
  const same = drawn.length === 4 && drawn.every(like);
  ctx.save();
  if (same) {
    const b = first;
    ctx.lineWidth = b.width;
    ctx.strokeStyle = b.color;
    ctx.setLineDash(dash(b));
    roundedRect(ctx, x + b.width / 2, y + b.width / 2, w - b.width, h - b.width, radius - b.width / 2);
    ctx.stroke();
  } else {
    for (const s of drawn) {
      ctx.lineWidth = s.width;
      ctx.strokeStyle = s.color;
      ctx.setLineDash(dash(s));
      ctx.beginPath();
      const half = s.width / 2;
      if (s.side === "Top") (ctx.moveTo(x, y + half), ctx.lineTo(x + w, y + half));
      if (s.side === "Bottom") (ctx.moveTo(x, y + h - half), ctx.lineTo(x + w, y + h - half));
      if (s.side === "Left") (ctx.moveTo(x + half, y), ctx.lineTo(x + half, y + h));
      if (s.side === "Right") (ctx.moveTo(x + w - half, y), ctx.lineTo(x + w - half, y + h));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * The key, wrapped to `width` as the legend's entries wrap on the page (each entry whole when it fits on a line, its
 * words wrapping only when it is wider than a line), from (x0, y0). Returns { ops, height }.
 */
function layoutKey(ctx, entries, width, x0, y0) {
  const ops = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const { li, swatches, text } of entries) {
    const style = textStyle(li);
    setFont(ctx, style);
    const sw = swatches.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, w: r.width, h: r.height };
    });
    const swW = sw.reduce((sum, k) => sum + k.w + KEY.swatch, 0);
    const textW = ctx.measureText(text).width;
    if (x > 0 && x + swW + textW > width) {
      y += rowH + KEY.row;
      x = 0;
      rowH = 0;
    }
    const lines = x + swW + textW > width ? wrap(ctx, text, width - x - swW) : [text];
    const mid = y + style.lineHeight / 2;
    let sx = x;
    for (const k of sw) {
      ops.push({ kind: "swatch", el: k.el, x: x0 + sx, y: y0 + mid - k.h / 2, w: k.w, h: k.h });
      sx += k.w + KEY.swatch;
    }
    ops.push({ kind: "text", lines, style, x: x0 + sx, y: y0 + y });
    rowH = Math.max(rowH, lines.length * style.lineHeight, ...sw.map((k) => k.h));
    x = lines.length > 1 ? width : sx + Math.max(...lines.map((l) => ctx.measureText(l).width)) + KEY.col;
  }
  return { ops, height: entries.length ? y + rowH : 0 };
}

// ------------------------------------------------------------------------------------------------------- the chart
/** Wait until the chart is still: no genre glide (its values) and no new order gliding (its transforms). */
function still(svg) {
  const moving = () => svg.classList.contains("gliding") || svg.querySelector("[data-glide][transform]");
  const t0 = performance.now();
  return new Promise((resolve) => {
    const check = () => (!moving() || performance.now() - t0 > 1500 ? resolve() : requestAnimationFrame(check));
    check();
  });
}

/**
 * The chart as a standalone SVG document: a clone at rest (no state classes, no glide transforms), with each element's
 * computed paint and text styles written on it, read while the clone sits hidden in the chart's own frame so that the
 * page's rules reach it. Its <defs> (the hatch) stay, with ids of their own. The text halos, drawn in the page's
 * background color, take the image's white. `margin` px around it keep anything drawn just outside its box.
 */
export function chartSvg(svg, margin = PAD) {
  const clone = svg.cloneNode(true);
  const all = () => [clone, ...clone.querySelectorAll("*")];
  for (const el of all()) {
    for (const c of STATES) el.classList.remove(c);
    if (el.hasAttribute("data-glide")) el.removeAttribute("transform");
  }
  const ids = new Map();
  for (const el of clone.querySelectorAll("[id]")) {
    ids.set(el.id, `${el.id}-png`);
    el.id = `${el.id}-png`;
  }
  // every reference points into the clone (a computed url() may come back with the page's address before the "#")
  const relink = (v) => v.replace(/url\((["']?)[^"')#]*#([^"')]+)\1\)/g, (m, q, id) => `url(#${ids.get(id) || id})`);
  for (const el of all()) {
    for (const a of ["fill", "stroke", "style"]) if (el.hasAttribute(a)) el.setAttribute(a, relink(el.getAttribute(a)));
  }

  const page = getComputedStyle(document.body).backgroundColor;
  const white = paper();
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
  holder.appendChild(clone);
  svg.parentNode.appendChild(holder);
  try {
    for (const el of all()) {
      const cs = getComputedStyle(el);
      const values = PAINT.map((p) => [p, cs.getPropertyValue(p)]);
      for (const [p, raw] of values) {
        if (!raw || (p === "transform" && raw === "none")) continue;
        let v = p === "fill" || p === "stroke" ? relink(raw) : raw;
        if (p === "stroke" && v === page && (el.tagName === "text" || el.tagName === "tspan")) v = white;
        el.style.setProperty(p, v);
      }
    }
  } finally {
    holder.remove();
  }

  for (const el of all()) {
    for (const a of [...el.attributes]) {
      if (a.name === "class" || a.name === "role" || a.name === "tabindex" || /^(aria|data)-/.test(a.name)) {
        el.removeAttribute(a.name);
      }
    }
  }
  const w = Number(svg.getAttribute("width")) || svg.getBoundingClientRect().width;
  const h = Number(svg.getAttribute("height")) || svg.getBoundingClientRect().height;
  clone.setAttribute("viewBox", `${-margin} ${-margin} ${w + 2 * margin} ${h + 2 * margin}`);
  clone.setAttribute("width", String((w + 2 * margin) * SCALE));
  clone.setAttribute("height", String((h + 2 * margin) * SCALE));
  return new XMLSerializer().serializeToString(clone);
}

function svgPicture(xml) {
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The chart could not be drawn as an image"));
    };
    img.src = url;
  });
}

// ------------------------------------------------------------------------------------------------------- the image
/** The whole image on a canvas at 2× pixels (the size of everything in CSS px, times SCALE). */
export async function drawChartImage(spec) {
  const { chart, legend } = spec;
  const svg = chart?.querySelector(".chart-frame svg");
  if (!svg) throw new Error("No chart to draw");
  if (document.fonts?.ready) await document.fonts.ready;
  await still(svg);
  const plan = imagePlan(spec);
  const panel = chart.closest(".chart-panel") || chart.parentNode;
  const titleStyle = styleOf(panel, panel.querySelector(".chart-title"), "h2", "chart-title");
  const subStyle = styleOf(panel, panel.querySelector(".chart-sub"), "p", "chart-sub");
  const creditStyle = styleOf(panel, chart.querySelector(".axis-caption"), "p", "axis-caption");

  const box = svg.getBoundingClientRect();
  const width = Math.round(box.width);
  const W = width + 2 * PAD;
  const ctx0 = document.createElement("canvas").getContext("2d");
  const ops = [];
  let y = PAD;
  const textBlock = (texts, style) => {
    for (const text of texts) {
      setFont(ctx0, style);
      const lines = wrap(ctx0, text, width);
      ops.push({ kind: "text", lines, style, x: PAD, y });
      y += lines.length * style.lineHeight;
    }
  };
  textBlock(plan.title, titleStyle);
  if (plan.subtitle.length) y += titleStyle.marginBottom;
  textBlock(plan.subtitle, subStyle);

  const entries = keyItems(legend);
  const legendStyle = legend ? textStyle(legend) : { marginTop: 12, marginBottom: 4 };
  if (entries.length) {
    y += legendStyle.marginTop;
    const key = layoutKey(ctx0, entries, width, PAD, y);
    ops.push(...key.ops);
    y += key.height;
  }

  // the lines above the plot and the plot keep their places relative to each other, as on the page
  const { above, below } = chartLines(chart);
  const content = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const left = r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const top = r.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
    return { top, left, width: r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - left };
  };
  const top0 = Math.min(box.top, ...above.map((el) => content(el).top));
  y += Math.max(entries.length ? legendStyle.marginBottom : 0, above.length ? textStyle(above[0]).marginTop : 8);
  for (const el of above) {
    const c = content(el);
    const style = textStyle(el);
    setFont(ctx0, style);
    const lines = wrap(ctx0, words(el), c.width);
    ops.push({ kind: "text", lines, style, x: PAD + c.left - box.left, y: y + c.top - top0 });
  }
  const svgTop = y + box.top - top0;
  ops.push({ kind: "svg", x: PAD, y: svgTop, w: box.width, h: box.height });
  y = svgTop + box.height;
  for (const el of below) {
    const style = textStyle(el);
    setFont(ctx0, style);
    y += style.marginTop;
    const lines = wrap(ctx0, words(el), width);
    ops.push({ kind: "text", lines, style, x: PAD, y });
    y += lines.length * style.lineHeight;
  }
  y += 16;
  ops.push({ kind: "text", lines: [plan.credit], style: creditStyle, x: W - PAD, y, align: "right" });
  y += creditStyle.lineHeight + PAD;
  const H = Math.ceil(y);

  const { img, url } = await svgPicture(chartSvg(svg, PAD));
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = paper();
  ctx.fillRect(0, 0, W, H);
  try {
    for (const op of ops) {
      if (op.kind === "text") drawLines(ctx, op);
      else if (op.kind === "swatch") drawSwatch(ctx, op);
      else ctx.drawImage(img, op.x - PAD, op.y - PAD, op.w + 2 * PAD, op.h + 2 * PAD);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

/**
 * Make the image and save it as `spec.fileName` (iOS Safari may open it instead, which is fine): a chart's, or the
 * comparisons' lists' (`spec.lists`).
 */
export async function downloadChartImage(spec) {
  const canvas = spec.lists ? await drawListsImage(spec) : await drawChartImage(spec);
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The image could not be made"))), "image/png"),
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = spec.fileName;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 40000); // a browser may still be reading it
}

// ------------------------------------------------------------------------------------- the comparisons' lists (O2)
// "Download image" of the Genres page's "One genre" and the Trends page's "What changed": their lists as the page shows
// them, made from the lists' plan (ComparisonProfile's listsPlan), not from the page's rows, always 760 CSS px wide on
// every screen, at 2×: the question as the title, the heading and the sample line as the subtitle, then each list's
// title and count, its caption (the axis title, or the mix line), the zone's bracket and the scale's ticks, and its
// rows (the label and unit lines; the values, or the two columns' numbers under their heads; the dot and its number,
// or a named group's two bars with the key of every group); no "›", no buttons, no link. The rows are one SVG, the
// titles canvas text in the page's own fonts, drawn through the same pipeline as the charts' images.
export const LISTS_W = 760;
const LIST = { label: 220, n: 70, gap: 12, pad: 4, row: 44, values: [110, 180] };
const ZONE_FILL = "#ece9e2"; // comparison.css's zone; its edges are the one gray for marks (--control)
/** A line of text at one of the scale's sizes, as the page sets it (px). */
const line = (size) => size * LEADING[size];

const xmlText = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\u200b/g, "");
const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** What the lists' image says, top to bottom, without drawing it (for the tests): every text in drawing order. */
export function listsImagePlan({ title, subtitle, lists }) {
  return {
    title: title.filter(Boolean),
    subtitle: subtitle.filter(Boolean),
    lists: lists.lists.map((l) => ({
      title: l.title,
      count: l.count,
      caption: l.caption,
      rows: l.rows.map((r) => ({
        label: r.label,
        unit: [r.unit, r.of].filter(Boolean),
        values: r.values ? [r.values.text, r.values.second].filter(Boolean) : null,
        numbers: r.numbers ? r.numbers.map((c) => (c ? c.filter(Boolean).join(" ") : "–")) : null,
        dot: r.dot ? r.dot.times : null,
        bars: Boolean(r.bars),
        few: r.few,
      })),
    })),
    credit: CREDIT,
  };
}

/** A text style the page gives `el` (or a stand-in of `tag.className` in `panel`), at a fixed size for the image. */
function fixedStyle(panel, el, tag, className, size, lineHeight) {
  const style = styleOf(panel, el, tag, className);
  return { ...style, font: style.font.replace(/(\d+(\.\d+)?)px/, `${size}px`), size, lineHeight };
}

/** The color the page gives a palette class (`pal-group-0` …), from a stand-in in `panel`. */
function paletteColor(panel, cls) {
  const probe = document.createElement("span");
  probe.className = cls;
  probe.style.cssText = "position:absolute;left:0;top:0;width:1px;height:1px;visibility:hidden";
  panel.appendChild(probe);
  const color = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return color;
}

/**
 * The lists as one SVG (CSS px, `width` wide) and the canvas texts that go with it (the lists' titles and counts, in
 * the page's own fonts): { xml, height, texts: [{ text, x, y, style, align }] }.
 */
function listsSvg(plan, { width, panel, sans, styles, ctx }) {
  const ink = cssVar("--ink", "#1c1c22");
  const ink2 = cssVar("--ink-2", "#45454f");
  const ink3 = cssVar("--ink-3", "#6b6b75");
  const rule1 = cssVar("--rule", "#e7e4dd");
  const rule2 = cssVar("--rule-2", "#d2cec5");
  const accent = cssVar("--accent-ink", "#2b63c6");
  const quiet = cssVar("--quiet-mark", "#857f75");
  const control = cssVar("--control", "#857f75");
  const zoneEdge = control;
  const white = paper();
  const font = (size, weight = 400) => `${weight} ${size}px ${sans}`;
  const measure = (text, size, weight = 400) => {
    ctx.font = font(size, weight);
    return ctx.measureText(text).width;
  };
  const wrapped = (text, size, maxW, weight = 400) => {
    ctx.font = font(size, weight);
    return wrap(ctx, text, maxW);
  };
  const fam = xmlText(sans);
  const parts = [];
  const text = (t, x, y, { size = 12, weight = 400, fill = ink, anchor = "start", italic = false, nums = false, halo = false } = {}) =>
    parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${fam}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
        ` text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}${nums ? ' style="font-variant-numeric:tabular-nums"' : ""}` +
        `${halo ? ` stroke="${white}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"` : ""}>${xmlText(t)}</text>`,
    );
  const rule = (x1, y1, x2, y2, stroke, w = 1) =>
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${w}"/>`);
  const rect = (x, y, w, h, fill, stroke = null) =>
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ""}/>`,
    );
  const colors = new Map();
  const colorOf = (cls) => {
    if (!colors.has(cls)) colors.set(cls, paletteColor(panel, cls));
    return colors.get(cls);
  };

  // the columns: the label · the values · the plot (values first), or the label · the plot · the two numbers
  const rows = plan.lists.flatMap((l) => l.rows);
  const vf = plan.valuesFirst;
  const valuesW = vf
    ? Math.min(LIST.values[1], Math.max(LIST.values[0], Math.ceil(Math.max(...rows.map((r) => measure(r.values.text, TEXT.secondary)))) + 8))
    : 0;
  const plotX = vf ? LIST.label + LIST.gap + valuesW + LIST.gap : LIST.label + LIST.gap;
  const plotW = vf ? width - plotX : width - plotX - 2 * (LIST.gap + LIST.n);
  const n1 = plotX + plotW + LIST.gap + LIST.n; // the right edges of the two number columns
  const n2 = n1 + LIST.gap + LIST.n;
  const inner = { x: plotX + LIST.pad, w: plotW - 2 * LIST.pad };
  const { scale, zone } = plan;
  const pct = (v) => ((v - scale.lo) / (scale.hi - scale.lo)) * 100;
  const X = (v) => inner.x + (pct(v) / 100) * inner.w;
  // the two columns' heads ("Romance", "All genres"), each in up to two lines of its column (a name may break after its
  // slash), else "Genre", as the page's wide heads
  const heads = vf
    ? null
    : plan.heads.map((h) => {
        const ls = wrapped(h.replace(/\u200b/g, " "), TEXT.tick, LIST.n, 600);
        return ls.length <= 2 ? ls : ["Genre"];
      });

  const texts = [];
  let y = 0;
  plan.lists.forEach((l, k) => {
    if (k) y += 26;
    // the title and its count, on the canvas in the page's fonts; a rule under them
    texts.push({ text: l.title, x: 0, y, style: styles.listTitle });
    texts.push({ text: l.count, x: width, y: y + (styles.listTitle.lineHeight - styles.count.lineHeight) * 0.7, style: styles.count, align: "right" });
    y += styles.listTitle.lineHeight + 6;
    rule(0, y, width, y, rule2);
    y += 1;
    if (l.caption) {
      y += 8;
      for (const t of wrapped(l.caption, TEXT.note, width, 600)) {
        text(t, 0, y + TEXT.note, { size: TEXT.note, weight: 600, fill: ink2 });
        y += line(TEXT.note);
      }
    }
    // the head row: the zone's bracket over the ticks, and the columns' heads
    const dots = l.rows.some((r) => r.dot);
    // (the tick labels `plan.tickDrop` px lower where a tick is at the zone's edge, under the bracket's ends, as the page)
    const drop = dots ? plan.tickDrop || 0 : 0;
    // the values' head may take lines of its own ("Median or share" over "2000–09 → 2020+"), as the heads do
    const valuesHead = vf ? [].concat(plan.valuesHead) : null;
    const headLines = vf ? valuesHead.length : heads ? Math.max(...heads.map((h) => h.length)) : 1;
    const headH = Math.max(30 + drop, headLines > 1 ? 16 * headLines + 4 : 30);
    const base = y + headH - 2;
    if (dots) {
      text(`${zone[0]}–${zone[1]}: ${plan.zoneWords}`, X(50), base - 17 - drop, { size: TEXT.tick, fill: ink2, anchor: "middle" });
      const by = base - 14 - drop;
      rule(X(zone[0]), by, X(zone[1]), by, zoneEdge);
      rule(X(zone[0]), by, X(zone[0]), by + 5, zoneEdge);
      rule(X(zone[1]), by, X(zone[1]), by + 5, zoneEdge);
      for (const t of scale.ticks) {
        const at = pct(t);
        text(String(t), X(t), base, { size: TEXT.tick, fill: ink3, anchor: at <= 0.01 ? "start" : at >= 99.99 ? "end" : "middle", nums: true });
      }
    }
    if (vf) valuesHead.forEach((t, j) => text(t, LIST.label + LIST.gap, base - 16 * (valuesHead.length - 1 - j), { size: TEXT.tick, weight: 600, fill: ink2 }));
    else {
      heads.forEach((h, c) => {
        h.forEach((t, j) => text(t, c ? n2 : n1, base - 16 * (h.length - 1 - j), { size: TEXT.tick, weight: 600, fill: ink2, anchor: "end" }));
      });
    }
    y += headH + 2;
    // the rows
    for (const r of l.rows) {
      const label = wrapped(r.label, TEXT.control, LIST.label);
      const units = [r.unit, r.of].filter(Boolean).flatMap((u, j) => wrapped(u, TEXT.note, LIST.label - (j === 0 && r.swatch ? 15 : 0)));
      // a named group's key under its bars: every group's swatch and name, an item never broken
      const keyLines = [];
      if (r.bars) {
        let current = [];
        let x = 0;
        for (const [b, name] of r.key.entries()) {
          const w = 15 + measure(name, TEXT.tick);
          if (x && x + w > plotW) {
            keyLines.push(current);
            current = [];
            x = 0;
          }
          current.push({ b, name, x });
          x += w + 12;
        }
        keyLines.push(current);
      }
      const textH = label.length * line(TEXT.control) + units.length * line(TEXT.note);
      const plotH = r.bars ? 20 + 4 + keyLines.length * 16 : 22;
      const h = Math.max(LIST.row, textH + 12, plotH + 12);
      const mid = y + h / 2;
      let ty = mid - textH / 2;
      for (const t of label) {
        text(t, 0, ty + 15, { size: TEXT.control, fill: ink });
        ty += line(TEXT.control);
      }
      units.forEach((t, j) => {
        let x = 0;
        if (j === 0 && r.swatch) {
          rect(0.5, ty + 4.5, 9, 9, colorOf(r.swatch), control);
          x = 15;
        }
        text(t, x, ty + 13, { size: TEXT.note, fill: ink3 });
        ty += line(TEXT.note);
      });
      // the values (values first) or the two numbers
      if (vf) {
        const two = Boolean(r.values.second);
        text(r.values.text, LIST.label + LIST.gap, mid + (two ? -2 : 5), { size: TEXT.secondary, fill: r.few ? ink3 : ink, nums: true });
        if (two) text(r.values.second, LIST.label + LIST.gap, mid + 13, { size: TEXT.tick, fill: ink3, nums: true });
      } else {
        r.numbers.forEach((col, c) => {
          const x = c ? n2 : n1;
          const two = Boolean(col?.[1]);
          text(col ? col[0] : "–", x, mid + (two ? -2 : 5), { size: TEXT.secondary, fill: r.few ? ink3 : c ? ink2 : ink, anchor: "end", nums: true });
          if (two) text(col[1], x, mid + 13, { size: TEXT.tick, fill: ink3, anchor: "end", nums: true });
        });
      }
      // the plot
      if (r.few) {
        text("Too few stories to compare", plotX, mid + 4, { size: TEXT.note, fill: ink3, italic: true });
      } else if (r.bars) {
        const top = mid - plotH / 2;
        r.bars.forEach((shares, j) => {
          let x = plotX + 2;
          shares.forEach((share, b) => {
            const w = share * (plotW - 4);
            if (w > 0) rect(x, top + 1 + j * 11, w, 7, colorOf(r.colors[b]), "#fff");
            x += w;
          });
        });
        keyLines.forEach((items, j) => {
          const ky = top + 24 + j * 16;
          for (const it of items) {
            rect(plotX + it.x + 0.5, ky + 1.5, 9, 9, colorOf(r.colors[it.b]), control);
            text(it.name, plotX + it.x + 15, ky + 10, { size: TEXT.tick, fill: ink2 });
          }
        });
      } else if (r.dot) {
        const d = r.dot;
        rect(X(zone[0]), mid - 9, X(zone[1]) - X(zone[0]), 18, ZONE_FILL);
        rule(X(zone[0]), mid - 9, X(zone[0]), mid + 9, zoneEdge);
        rule(X(zone[1]), mid - 9, X(zone[1]), mid + 9, zoneEdge);
        rule(X(50), mid - 11, X(50), mid + 11, ink3);
        const color = d.flagged ? accent : quiet;
        if (d.to > d.from) rule(X(d.from), mid, X(d.to), mid, color, d.flagged ? 2 : 1.5);
        const dotR = d.flagged ? MARK.score : MARK.quiet;
        parts.push(`<circle cx="${X(d.end).toFixed(1)}" cy="${mid.toFixed(1)}" r="${dotR}" fill="${color}"/>`);
        const loud = d.flagged && !vf;
        const size = loud ? TEXT.note : TEXT.tick;
        const weight = loud ? 600 : 400;
        // the page's own placement (numberPlace, in the plan: this module imports nothing the pages load)
        const at = plan.place(d.r, { plotW: inner.w, dotR, textW: measure(String(d.times), size, weight) });
        text(String(d.times), inner.x + (at.x / 100) * inner.w + at.dx, mid + 4.5, {
          size,
          weight,
          fill: vf ? ink2 : d.flagged ? ink : ink3,
          anchor: at.anchor,
          nums: true,
          halo: true,
        });
      }
      y += h;
      rule(0, y, width, y, rule1);
    }
  });
  const height = Math.ceil(y + 1);
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * SCALE}" height="${height * SCALE}" viewBox="0 0 ${width} ${height}">` +
    `${parts.join("")}</svg>`;
  return { xml, height, texts };
}

/** The lists' image on a canvas at 2× pixels (LISTS_W CSS px wide), from the spec the page's button gives. */
export async function drawListsImage(spec) {
  const plan = spec.lists;
  const panel = spec.panel;
  if (!plan?.lists?.length || !panel) throw new Error("No lists to draw");
  if (document.fonts?.ready) await document.fonts.ready;
  const W = LISTS_W;
  const width = W - 2 * PAD;
  // the page's sizes at a desktop's: the heading's 20–26 at 24 px, the lists' titles 20, the line under them 14
  const titleStyle = fixedStyle(panel, null, "h2", "chart-title", 24, 24 * LEADING[26]);
  const subStyle = fixedStyle(panel, null, "p", "chart-sub", TEXT.secondary, line(TEXT.secondary));
  const styles = {
    listTitle: fixedStyle(panel, panel.querySelector(".profile-list-head h3"), "h3", "", 20, 20 * LEADING[20]),
    count: fixedStyle(panel, null, "span", "list-count", TEXT.secondary, line(TEXT.secondary)),
  };
  const creditStyle = styleOf(panel, null, "p", "axis-caption");
  const ctx = document.createElement("canvas").getContext("2d");
  const ops = [];
  let y = PAD;
  const textBlock = (texts, style) => {
    for (const text of texts) {
      setFont(ctx, style);
      const lines = wrap(ctx, text, width);
      ops.push({ kind: "text", lines, style, x: PAD, y });
      y += lines.length * style.lineHeight;
    }
  };
  textBlock(spec.title.filter(Boolean), titleStyle);
  y += 6;
  textBlock(spec.subtitle.filter(Boolean), subStyle);
  y += 20;
  const sans = getComputedStyle(panel).fontFamily;
  const lists = listsSvg(plan, { width, panel, sans, styles, ctx });
  const top = y;
  ops.push({ kind: "lists", x: PAD, y: top, w: width, h: lists.height });
  for (const t of lists.texts) {
    ops.push({ kind: "text", lines: [t.text], style: t.style, x: PAD + t.x, y: top + t.y, align: t.align || "left" });
  }
  y = top + lists.height + 16;
  ops.push({ kind: "text", lines: [CREDIT], style: creditStyle, x: W - PAD, y, align: "right" });
  y += creditStyle.lineHeight + PAD;
  const H = Math.ceil(y);

  const { img, url } = await svgPicture(lists.xml);
  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const out = canvas.getContext("2d");
  out.scale(SCALE, SCALE);
  out.fillStyle = paper();
  out.fillRect(0, 0, W, H);
  try {
    for (const op of ops) {
      if (op.kind === "lists") out.drawImage(img, op.x, op.y, op.w, op.h);
      else drawLines(out, op);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}
