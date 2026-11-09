// "outside the lab" map + list on the home page.
// Markup and styles: _includes/outside_the_lab.liquid. Trips: _data/outside_the_lab.yml.
(function () {
  "use strict";
  const root = document.getElementById("outside-the-lab");
  const DATA = window.OTL_DATA;
  if (!root || !DATA) return;

  const HOME = DATA.home;
  const PLACES = DATA.places || [];
  const PHOTO_BASE = window.OTL_PHOTO_BASE || "/assets/img/outside_the_lab/";
  const photoSrc = (id, k) => `${PHOTO_BASE}${id}/${k + 1}.jpg`;
  const TYPE_LABEL = { ski: "Ski", hike: "Hike", travel: "Travel", conf: "Conference" };
  const TYPE_ICON = { ski: "🎿", hike: "🥾", travel: "🧭", conf: "🎤" };
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /* ===== Projection (equirectangular, cropped to where the pins are) ===== */
  const LON0 = -152, LON1 = 185, LAT0 = 75, LAT1 = -52;
  const VW = 1000, K = VW / (LON1 - LON0), VH = Math.round((LAT0 - LAT1) * K);
  const P = (lon, lat) => [(lon - LON0) * K, (LAT0 - lat) * K];

  /* Land drawn bigger than life (Q-style). Shapes and pins in a group share one transform. */
  const GROUPS = { jp: { cx: 137.5, cy: 37, scale: 2.5, dx: 8, dy: -2.5 } };
  const G = (lon, lat, g) => {
    const t = GROUPS[g];
    return t ? [t.cx + t.dx + (lon - t.cx) * t.scale, t.cy + t.dy + (lat - t.cy) * t.scale] : [lon, lat];
  };
  const PP = (p) => P(...G(+p.lon, +p.lat, p.group));

  /* Hand-simplified land blobs (lon, lat). scale > 1 exaggerates small places. */
  const LAND = [
    { pts: [[-165,64],[-140,70],[-100,72],[-80,68],[-62,58],[-55,48],[-70,42],[-76,35],[-81,26],[-90,29],[-97,26],[-105,20],[-110,23],[-118,33],[-124,40],[-125,48],[-135,58],[-150,60]] },
    { pts: [[-50,80],[-25,77],[-20,70],[-42,60],[-55,68]], faint: true },
    { pts: [[-80,10],[-60,8],[-35,-6],[-40,-22],[-58,-38],[-68,-52],[-75,-40],[-80,-5]], faint: true },
    { pts: [[-10,36],[-9,43],[-2,47],[3,51],[8,54],[10,58],[5,62],[15,69],[28,71],[40,67],[45,55],[40,45],[28,41],[20,40],[12,38],[0,38]] },
    { pts: [[-6,50],[1,51],[2,53],[-1,57],[-3,59],[-6,57],[-5,54]], scale: 1.3 },
    { pts: [[-24,64],[-21,66.5],[-14,66.3],[-13,64.6],[-19,63.4]], scale: 1.4 },
    { pts: [[-17,21],[-10,35],[10,37],[33,31],[43,12],[51,11],[40,-15],[32,-28],[20,-35],[12,-18],[9,4],[-8,5],[-17,14]], faint: true },
    { pts: [[40,45],[45,55],[60,70],[100,77],[140,73],[180,68],[178,62],[160,60],[143,52],[135,43],[127,38],[122,30],[120,22],[108,20],[106,10],[100,13],[98,8],[92,22],[80,15],[77,8],[72,20],[66,25],[57,25],[50,30],[35,33],[30,37]] },
    { pts: [[131.5,32],[132.5,34],[135,34],[140,35],[141,38],[141.5,41],[140,40],[138,37],[133,35.5],[131.5,34.2]], group: "jp" },
    { pts: [[140,42],[145,43.5],[142,45.5],[140,43.5]], group: "jp" },
    { pts: [[124.5,40],[128.5,38.8],[129.5,35.6],[127.6,34.4],[126.1,34.6],[126.4,37.2]], scale: 1.2 },
    { pts: [[120.2,22.5],[121,22],[121.9,25],[121.5,25.3],[120.1,23.5]], scale: 2.4 },
    { pts: [[114,-22],[122,-18],[131,-12],[137,-12],[142,-11],[146,-19],[153,-26],[151,-34],[146,-39],[138,-35],[131,-31.5],[116,-35],[115,-30]] },
    { pts: [[173,-35],[176,-37.5],[178,-38],[175,-41.5],[172.7,-40.5]], scale: 1.5 },
    { pts: [[172.6,-40.6],[174,-41.7],[171,-44.5],[167,-46.5],[166.5,-45],[170,-43]], scale: 1.5 },
  ];

  function blobPath(shape) {
    let pts = shape.pts.map(([lon, lat]) => P(...G(lon, lat, shape.group)));
    if (shape.scale) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      pts = pts.map(([x, y]) => [cx + (x - cx) * shape.scale, cy + (y - cy) * shape.scale]);
    }
    const n = pts.length, f = (v) => v.toFixed(1);
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      // closed Catmull-Rom -> cubic Bezier, for soft "Q" edges
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
    }
    return d + "Z";
  }

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ===== Build map ===== */
  const svg = document.getElementById("otl-map");
  svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
  const gLand = el("g", { "aria-hidden": "true" }, svg);
  LAND.forEach((s) => el("path", { d: blobPath(s), class: "land" + (s.faint ? " faint" : "") }, gLand));

  const [hx, hy] = P(+HOME.lon, +HOME.lat);
  const gArcs = el("g", { "aria-hidden": "true" }, svg);
  const arcs = {};
  PLACES.filter((p) => p.status !== "someday").forEach((p) => {
    const [x, y] = PP(p);
    const mx = (hx + x) / 2, my = (hy + y) / 2, dx = x - hx, dy = y - hy, len = Math.hypot(dx, dy);
    const bend = Math.min(0.28 * len, 140);
    let nx = dy / len, ny = -dx / len; // perpendicular; always bow upwards
    if (ny > 0) { nx = -nx; ny = -ny; }
    arcs[p.id] = el("path", { d: `M${hx},${hy} Q${mx + nx * bend},${my + ny * bend} ${x},${y}`, class: "arc" }, gArcs);
  });

  const gHome = el("g", { "aria-label": `Home: ${HOME.name}`, role: "img" }, svg);
  const homeG = el("g", {}, gHome); // drawn at screen-pixel size by sizeMarks()
  el("text", { x: hx, y: hy + 8, "text-anchor": "middle", style: "font-size:24px" }, homeG).textContent = "🏡";
  el("text", { x: hx - 12, y: hy + 22, "text-anchor": "end", class: "map-label", style: "font-size:12.5px;stroke-width:3.5px" }, homeG).textContent = "Home";

  const gPins = el("g", {}, svg);
  const pinEls = {};
  PLACES.forEach((p) => {
    const [x, y] = PP(p);
    const g = el("g", {
      class: `pin ${p.status}`, tabindex: "0", role: "button", "data-id": p.id,
      "aria-label": `${p.title}${p.date ? ", " + p.date : ""}${p.status === "someday" ? ", someday" : ""}`,
    }, gPins);
    el("circle", { cx: x, cy: y, class: "hit" }, g);
    if (p.status === "next") el("circle", { cx: x, cy: y, class: "pulse", stroke: `var(--otl-${p.type})` }, g);
    el("circle", { cx: x, cy: y, class: "ring-focus" }, g);
    el("circle", { cx: x, cy: y, class: "core", fill: `var(--otl-${p.type})` }, g);
    const t = el("text", { class: "map-label" + (p.status === "someday" ? " someday" : "") }, g);
    t.textContent = p.label;
    t.dataset.side = p.label_side || "right";
    t.dataset.x = x;
    t.dataset.y = y;
    pinEls[p.id] = g;
  });

  /* Pins and labels are sized in screen pixels, whatever width the map is drawn at. */
  function sizeMarks() {
    const f = VW / svg.getBoundingClientRect().width; // viewBox units per screen px
    if (!isFinite(f) || f <= 0) return;
    svg.querySelectorAll(".pin").forEach((g) => {
      g.querySelector(".hit").setAttribute("r", 18 * f);
      g.querySelector(".core").setAttribute("r", 7 * f);
      g.querySelector(".core").style.strokeWidth = 2.5 * f;
      g.querySelector(".ring-focus").setAttribute("r", 11 * f);
      const pulse = g.querySelector(".pulse");
      if (pulse) pulse.setAttribute("r", 7 * f);
    });
    svg.querySelectorAll(".pin .map-label").forEach((t) => {
      const x = +t.dataset.x, y = +t.dataset.y, fs = 12.5 * f, gap = 11 * f, side = t.dataset.side;
      t.style.fontSize = fs + "px";
      t.style.strokeWidth = 3.5 * f + "px";
      t.setAttribute("text-anchor", side === "left" ? "end" : side === "right" ? "start" : "middle");
      t.setAttribute("x", side === "left" ? x - gap : side === "right" ? x + gap : x);
      t.setAttribute("y", side === "above" ? y - gap : side === "below" ? y + gap + fs * 0.8 : y + fs * 0.35);
    });
    homeG.setAttribute("transform", `translate(${hx} ${hy}) scale(${f}) translate(${-hx} ${-hy})`);
  }

  /* ===== Popover ===== */
  const box = document.getElementById("otl-map-box");
  const pop = document.getElementById("otl-pop");
  const popBody = document.getElementById("otl-pop-body");
  let current = null, locked = false;
  const isSheet = () => matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const nPhotos = (p) => (p.photos ? p.photos.length : 0);
  const photoHTML = (p) =>
    p.photos
      .map((alt, k) => `<a class="otl-ph img" href="${photoSrc(p.id, k)}" target="_blank" rel="noopener"><img src="${photoSrc(p.id, k)}" alt="${esc(alt)}" loading="lazy"></a>`)
      .join("");
  const badgeHTML = (p, cls) =>
    p.status === "someday" ? `<span class="${cls} someday">Someday</span>`
      : p.status === "next" ? `<span class="${cls} ${p.type}">Next stop</span>`
      : `<span class="${cls} ${p.type}">${TYPE_LABEL[p.type]}</span>`;
  const metaText = (p) => esc(p.place) + (p.date ? " · " + esc(p.date) : "");

  function render(p) {
    popBody.innerHTML = `${badgeHTML(p, "otl-badge")}<h3 id="otl-pop-title">${esc(p.title)}</h3>
      <div class="otl-meta">${metaText(p)}</div>
      <p>${esc(p.text)}</p>${nPhotos(p) ? `<div class="otl-photos">${photoHTML(p)}</div>` : ""}`;
  }

  function place(id) {
    if (isSheet()) { pop.style.left = ""; pop.style.top = ""; return; }
    const r = pinEls[id].querySelector(".core").getBoundingClientRect(), b = box.getBoundingClientRect();
    const cx = r.left + r.width / 2 - b.left, cy = r.top + r.height / 2 - b.top;
    const w = pop.offsetWidth, h = pop.offsetHeight, pad = 10, gap = 20;
    // Sit beside the pin (towards the roomier side) so the pin stays visible.
    let left = cx > b.width / 2 ? cx - w - gap : cx + gap;
    let top = cy - h / 2;
    if (left < pad || left + w > b.width - pad) {
      left = cx - w / 2;
      top = cy - h - gap;
      if (top < pad) top = cy + gap;
    }
    left = Math.max(pad, Math.min(left, b.width - w - pad));
    top = Math.max(pad, Math.min(top, b.height - h - pad));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function deactivate(id) {
    if (pinEls[id]) pinEls[id].classList.remove("active");
    if (arcs[id]) arcs[id].classList.remove("active");
  }
  function open(id, lock) {
    const p = PLACES.find((q) => q.id === id);
    if (!p) return;
    if (current && current !== id) deactivate(current);
    current = id;
    locked = !!lock;
    render(p);
    pop.classList.add("show");
    pop.classList.toggle("locked", locked);
    pinEls[id].classList.add("active");
    if (arcs[id]) arcs[id].classList.add("active");
    place(id);
  }
  function close() {
    if (current) deactivate(current);
    current = null;
    locked = false;
    pop.classList.remove("show", "locked");
  }

  Object.entries(pinEls).forEach(([id, g]) => {
    g.addEventListener("mouseenter", () => { if (!locked && !isSheet()) open(id, false); });
    g.addEventListener("mouseleave", () => { if (!locked && !isSheet()) close(); });
    g.addEventListener("click", (e) => { e.stopPropagation(); locked && current === id ? close() : open(id, true); });
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(id, true); }
    });
  });
  document.getElementById("otl-pop-close").addEventListener("click", (e) => { e.stopPropagation(); close(); });
  document.addEventListener("click", (e) => { if (current && !pop.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) { const id = current; close(); pinEls[id].focus(); }
  });
  addEventListener("resize", () => { sizeMarks(); if (current) place(current); });
  sizeMarks();

  // On narrow screens the map is wider than the screen; start scrolled to the Asia-Pacific side (home).
  const scroller = document.getElementById("otl-map-scroll");
  scroller.scrollLeft = scroller.scrollWidth;
  scroller.addEventListener("scroll", () => { root.querySelector(".otl-swipe-hint").style.opacity = 0; }, { once: true });

  /* ===== List ===== */
  const panelList = document.getElementById("otl-panel-list");
  const groups = [
    ["Next stop", PLACES.filter((p) => p.status === "next")],
    ["Been there", PLACES.filter((p) => p.status === "visited").sort((a, b) => String(b.when).localeCompare(String(a.when)))],
    ["Someday", PLACES.filter((p) => p.status === "someday")],
  ];
  const thumbHTML = (p) =>
    nPhotos(p)
      ? `<div class="otl-ph img"><img src="${photoSrc(p.id, 0)}" alt="${esc(p.photos[0])}" loading="lazy"></div>`
      : p.status === "someday"
        ? `<div class="otl-ph someday" aria-hidden="true"></div>`
        : `<div class="otl-ph ${p.type}" aria-hidden="true">${TYPE_ICON[p.type]}</div>`;
  panelList.innerHTML = groups
    .filter(([, items]) => items.length)
    .map(([name, items]) => `<h3 class="otl-group-title">${name}</h3>` + items.map((p) => `
      <article class="otl-item">
        <div>${badgeHTML(p, "otl-abbr")}${thumbHTML(p)}</div>
        <div>
          <h3>${esc(p.title)}</h3>
          <div class="otl-meta">${metaText(p)}</div>
          <p>${esc(p.text)}</p>
          <button type="button" class="otl-linkish" data-show="${p.id}">Show on map</button>
        </div>
      </article>`).join(""))
    .join("");
  panelList.addEventListener("click", (e) => {
    const id = e.target.dataset && e.target.dataset.show;
    if (!id) return;
    e.stopPropagation();
    selectTab("map");
    requestAnimationFrame(() => open(id, true));
  });

  /* ===== Tabs ===== */
  const tabs = { map: document.getElementById("otl-tab-map"), list: document.getElementById("otl-tab-list") };
  const panels = { map: document.getElementById("otl-panel-map"), list: panelList };
  function selectTab(name, focus) {
    for (const k of Object.keys(tabs)) {
      const on = k === name;
      tabs[k].setAttribute("aria-selected", on);
      tabs[k].tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    }
    if (name !== "map") close();
    else sizeMarks();
    if (focus) tabs[name].focus();
    try { localStorage.setItem("otl-view", name); } catch (_) {}
  }
  tabs.map.addEventListener("click", () => selectTab("map"));
  tabs.list.addEventListener("click", () => selectTab("list"));
  root.querySelector(".otl-tabs").addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") selectTab(tabs.map.getAttribute("aria-selected") === "true" ? "list" : "map", true);
  });
  try { if (localStorage.getItem("otl-view") === "list") selectTab("list"); } catch (_) {}

  /* Deep links, e.g. /#open=tahoe or /#view=list */
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("view") || hash.get("open")) root.scrollIntoView();
  if (hash.get("view") === "list") selectTab("list");
  if (hash.get("open")) { selectTab("map"); requestAnimationFrame(() => open(hash.get("open"), true)); }
})();
