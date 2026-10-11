// "Download PNG" (the owner's decision 7): the chart on screen as a PNG file, made in the browser, with no request.
// On white, top to bottom: the title, the subtitle and the key, then the chart with the lines drawn above and under
// it, and the credit at the bottom right. The chart is its live <svg>, cloned at rest (no hover, focus, tap or glide)
// with every element's computed paint and text styles written on it, and drawn as an image at its own width and in its
// own layout; the text and the key's swatches are drawn with the canvas's 2D API in the fonts and colors the page uses
// for them, read from their computed styles. Always 2× pixels. Loaded when the button is first hovered, focused or
// pressed (DownloadPng.jsx).

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

/** Make the image and save it as `spec.fileName` (iOS Safari may open it instead, which is fine). */
export async function downloadChartImage(spec) {
  const canvas = await drawChartImage(spec);
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
