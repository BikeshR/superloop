import type { Control, Graph } from "./types";

const NODE_W = 150;
const NODE_H = 90;
const GAP_X = 70;
const Y = 90;
const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Renders the tech-tree/pipeline hybrid: nodes laid out left-to-right in
 *  pipeline order, forward edges as straight arrows, the one feedback edge
 *  (output -> memory) as a curved arc underneath so it doesn't cross the row. */
export function renderGraph(svg: SVGSVGElement, graph: Graph, control: Control) {
  svg.innerHTML = "";
  const indexById = new Map(graph.nodes.map((n, i) => [n.id, i]));
  const width = graph.nodes.length * (NODE_W + GAP_X) + GAP_X;
  const height = 260;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));

  const defs = el("defs");
  const marker = el("marker", {
    id: "arrow",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse",
  });
  const arrowPath = el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "var(--wire)" });
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const xOf = (i: number) => GAP_X + i * (NODE_W + GAP_X);
  const centerOf = (id: string) => {
    const i = indexById.get(id) ?? 0;
    return { x: xOf(i) + NODE_W / 2, y: Y + NODE_H / 2 };
  };

  // Edges first so nodes render on top.
  const edgeLayer = el("g", { class: "edges" });
  for (const edge of graph.edges) {
    const fromIdx = indexById.get(edge.from) ?? 0;
    const toIdx = indexById.get(edge.to) ?? 0;
    const isFeedback = toIdx <= fromIdx;
    let d: string;
    if (!isFeedback) {
      const x1 = xOf(fromIdx) + NODE_W;
      const x2 = xOf(toIdx);
      const y = Y + NODE_H / 2;
      d = `M ${x1} ${y} L ${x2} ${y}`;
    } else {
      const from = centerOf(edge.from);
      const to = centerOf(edge.to);
      const arcY = Y + NODE_H + 60;
      d = `M ${from.x} ${Y + NODE_H} C ${from.x} ${arcY}, ${to.x} ${arcY}, ${to.x} ${Y + NODE_H}`;
    }
    const path = el("path", {
      d,
      class: isFeedback ? "wire wire-feedback" : "wire",
      "marker-end": "url(#arrow)",
      "data-from": edge.from,
      "data-to": edge.to,
    });
    edgeLayer.appendChild(path);
  }
  svg.appendChild(edgeLayer);

  // Nodes
  const nodeLayer = el("g", { class: "nodes" });
  graph.nodes.forEach((node, i) => {
    const x = xOf(i);
    const g = el("g", { class: `node node-${node.status}`, "data-node-id": node.id, transform: `translate(${x}, ${Y})` });

    const rect = el("rect", { class: "node-rect", width: NODE_W, height: NODE_H, rx: 10 });
    g.appendChild(rect);

    const label = el("text", { class: "node-label", x: NODE_W / 2, y: 24, "text-anchor": "middle" });
    label.textContent = node.label;
    g.appendChild(label);

    const levelText = el("text", { class: "node-level", x: NODE_W / 2, y: 42, "text-anchor": "middle" });
    levelText.textContent = node.status === "locked" ? "locked" : `Lv ${node.level}`;
    g.appendChild(levelText);

    const barBg = el("rect", { class: "xp-bg", x: 10, y: 58, width: NODE_W - 20, height: 8, rx: 4 });
    g.appendChild(barBg);
    const pct = Math.min(1, (node.xp % control.xpPerLevel) / control.xpPerLevel);
    const barFg = el("rect", { class: "xp-fg", x: 10, y: 58, width: Math.max(0, (NODE_W - 20) * pct), height: 8, rx: 4 });
    g.appendChild(barFg);

    const xpText = el("text", { class: "node-xp", x: NODE_W / 2, y: 78, "text-anchor": "middle" });
    xpText.textContent = `${node.xp} xp`;
    g.appendChild(xpText);

    nodeLayer.appendChild(g);
  });
  svg.appendChild(nodeLayer);
}

/** Briefly flashes a node (and its incoming edge, if known) green/red when a
 *  fresh log entry arrives for it, so activity is visible without a full
 *  re-render. */
export function pulseNode(svg: SVGSVGElement, nodeId: string, kind: "success" | "fail") {
  const group = svg.querySelector(`.node[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!group) return;
  const cls = kind === "success" ? "pulse-success" : "pulse-fail";
  group.classList.add(cls);
  setTimeout(() => group.classList.remove(cls), 1200);

  const edge = svg.querySelector(`.wire[data-to="${CSS.escape(nodeId)}"]`);
  if (edge) {
    edge.classList.add(cls);
    setTimeout(() => edge.classList.remove(cls), 1200);
  }
}
