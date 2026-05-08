const landingSec = document.getElementById("landing");
const appView = document.getElementById("app-view");
const aboutView = document.getElementById("about-view");
const enterBtn = document.getElementById("enter");

const form = document.getElementById("check-form");
const inputEl = document.getElementById("input");
const imageEl = document.getElementById("image");
const submitBtn = document.getElementById("submit");
const linkPreviewEl = document.getElementById("link-preview");

const reviewSec = document.getElementById("review");
const claimEditorsEl = document.getElementById("claim-editors");
const claimCountEl = document.getElementById("claim-count");
const addClaimBtn = document.getElementById("add-claim");
const verifyBtn = document.getElementById("verify-btn");

const resultSec = document.getElementById("result");
const loadingSec = document.getElementById("loading");
const loadingMsg = document.getElementById("loading-msg");
const agentPlanEl = document.getElementById("agent-plan");
const reactorBar = document.getElementById("reactor-bar");
const errorSec = document.getElementById("error");
const claimCardsEl = document.getElementById("claim-cards");

const BAND_CLASS = {
  "Supported": "supported",
  "Partially supported": "partial",
  "Insufficient evidence": "insufficient",
  "Contradicted": "contradicted",
  "Known misinformation": "misinfo",
};

const URL_RE = /^https?:\/\//i;
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/i;
const PREVIEW_DEBOUNCE_MS = 450;

let lastNonAbout = "landing";
let previewTimer = null;
let previewController = null;
let previewUrl = "";
let planTimer = null;
let activePlan = [];
let activePlanIndex = 0;
function showView(name) {
  landingSec.hidden = name !== "landing";
  appView.hidden = name !== "app";
  aboutView.hidden = name !== "about";
  if (name !== "about") lastNonAbout = name;
  window.scrollTo({ top: 0, behavior: "instant" });
}

if (enterBtn) {
  enterBtn.addEventListener("click", () => {
    showView("app");
    setTimeout(() => inputEl?.focus({ preventScroll: true }), 50);
  });
}

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-nav]");
  if (!t) return;
  const nav = t.dataset.nav;
  if (nav === "about") { ev.preventDefault(); showView("about"); }
  else if (nav === "back") { ev.preventDefault(); showView(lastNonAbout); }
  else if (nav === "home") { ev.preventDefault(); showView("landing"); }
});

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = reject;
  r.readAsDataURL(file);
});

function showOnly(...sections) {
  for (const s of [reviewSec, resultSec, loadingSec, errorSec]) s.hidden = true;
  for (const s of sections) s.hidden = false;
}

function stopAgentPlan() {
  if (planTimer) clearTimeout(planTimer);
  planTimer = null;
}

function updateReactorProgress() {
  if (!reactorBar || activePlan.length === 0) return;
  const pct = Math.min(100, ((activePlanIndex + 1) / activePlan.length) * 100);
  reactorBar.style.width = pct + "%";
}

function renderAgentPlan() {
  agentPlanEl.innerHTML = "";
  updateReactorProgress();
  activePlan.forEach((step, index) => {
    const li = document.createElement("li");
    li.className = "agent-plan-step";
    if (index < activePlanIndex) li.dataset.state = "done";
    else if (index === activePlanIndex) li.dataset.state = "active";
    else li.dataset.state = "pending";

    const marker = document.createElement("span");
    marker.className = "agent-plan-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = index < activePlanIndex ? "✓" : index === activePlanIndex ? "•" : "";

    const body = document.createElement("div");
    body.className = "agent-plan-body";

    const row = document.createElement("div");
    row.className = "agent-plan-row";
    const title = document.createElement("strong");
    title.textContent = step.title;

    const badge = document.createElement("span");
    badge.className = "agent-plan-badge";
    badge.textContent = index < activePlanIndex ? "done" : index === activePlanIndex ? "running" : "queued";
    row.append(title, badge);

    const detail = document.createElement("span");
    detail.className = "agent-plan-detail";
    detail.textContent = step.detail;

    body.append(row, detail);

    if (step.tools?.length) {
      const tools = document.createElement("div");
      tools.className = "agent-tools";
      step.tools.forEach((tool) => {
        const chip = document.createElement("span");
        chip.textContent = tool;
        tools.appendChild(chip);
      });
      body.appendChild(tools);
    }

    li.append(marker, body);
    agentPlanEl.appendChild(li);
  });
}

function startAgentPlan(steps) {
  stopAgentPlan();
  activePlan = steps;
  activePlanIndex = 0;
  renderAgentPlan();

  function scheduleNext() {
    if (activePlanIndex >= activePlan.length - 1) return;
    const delays = [1200, 3200, 4800, 2400, 3600, 2000];
    const delay = delays[activePlanIndex] || 2800;
    planTimer = setTimeout(() => {
      activePlanIndex += 1;
      renderAgentPlan();
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function completeAgentPlan() {
  stopAgentPlan();
  activePlanIndex = activePlan.length;
  renderAgentPlan();
  if (reactorBar) reactorBar.style.width = "100%";
}

function failAgentPlan() {
  stopAgentPlan();
  const current = agentPlanEl.querySelector("[data-state='active']");
  if (current) current.dataset.state = "error";
}

function extractionPlan(hasUrl, hasImage) {
  const sourceStep = hasImage
    ? { title: "Reading image input", detail: "Preparing the screenshot for the Manager.", tools: ["vision", "manager"] }
    : hasUrl
      ? { title: "Fetching source", detail: "Loading page metadata and readable content.", tools: ["ingestion", "manager"] }
      : { title: "Reading text", detail: "Sending the claim text to the Manager.", tools: ["manager"] };

  return [
    sourceStep,
    { title: "Manager triage", detail: "Choosing the right ingestion path and health domain.", tools: ["router", "health-domain"] },
    { title: "Claim extraction", detail: "Identifying the main claim and supporting sub-claims.", tools: ["claim-parser"] },
    { title: "Preparing review", detail: "Formatting editable claims before verification.", tools: ["schema-validator"] },
  ];
}

function verificationPlan(claimCount) {
  return [
    { title: "Dispatching investigators", detail: `${claimCount} claim${claimCount === 1 ? "" : "s"} queued for evidence search.`, tools: ["dispatcher"] },
    { title: "Querying evidence", detail: "Checking PubMed, public-health sources, and fact-check databases.", tools: ["PubMed", "WHO/CDC", "Fact Check"] },
    { title: "Reducing findings", detail: "Scoring evidence strength and contradictions.", tools: ["evidence-reducer"] },
    { title: "Writing verdicts", detail: "Preparing the cited explanation for each claim.", tools: ["narrative-agent"] },
  ];
}

function firstUrl(value) {
  const match = value.match(URL_IN_TEXT_RE);
  if (!match) return "";
  return match[0].replace(/[),.;!?]+$/, "");
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function hideLinkPreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = null;
  if (previewController) previewController.abort();
  previewController = null;
  previewUrl = "";
  linkPreviewEl.hidden = true;
  linkPreviewEl.innerHTML = "";
  linkPreviewEl.className = "link-preview";
}

function renderPreviewLoading(url) {
  linkPreviewEl.className = "link-preview is-loading";
  linkPreviewEl.hidden = false;
  linkPreviewEl.innerHTML = "";

  const meta = document.createElement("div");
  meta.className = "preview-meta";
  const kicker = document.createElement("span");
  kicker.className = "preview-kicker";
  kicker.textContent = "Link preview";
  const title = document.createElement("p");
  title.className = "preview-title";
  title.textContent = hostnameFor(url);
  const desc = document.createElement("p");
  desc.className = "preview-desc";
  desc.textContent = "Fetching page details…";
  meta.append(kicker, title, desc);
  linkPreviewEl.appendChild(meta);
}

function renderPreview(data) {
  linkPreviewEl.className = "link-preview";
  linkPreviewEl.hidden = false;
  linkPreviewEl.innerHTML = "";

  if (data.image) {
    const media = document.createElement("div");
    media.className = "preview-media";
    const img = document.createElement("img");
    img.src = data.image;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => media.remove());
    media.appendChild(img);
    linkPreviewEl.appendChild(media);
  } else {
    const media = document.createElement("div");
    media.className = "preview-media preview-fallback";
    const mark = document.createElement("span");
    mark.textContent = hostnameFor(data.final_url || data.url).slice(0, 1).toUpperCase() || "L";
    media.appendChild(mark);
    linkPreviewEl.appendChild(media);
  }

  const meta = document.createElement("div");
  meta.className = "preview-meta";
  const kicker = document.createElement("span");
  kicker.className = "preview-kicker";
  kicker.textContent = data.site_name || hostnameFor(data.final_url || data.url);
  const title = document.createElement("p");
  title.className = "preview-title";
  title.textContent = data.title || hostnameFor(data.final_url || data.url);
  meta.append(kicker, title);

  if (data.description) {
    const desc = document.createElement("p");
    desc.className = "preview-desc";
    desc.textContent = data.description;
    meta.appendChild(desc);
  }

  const url = document.createElement("span");
  url.className = "preview-url";
  url.textContent = hostnameFor(data.final_url || data.url);
  meta.appendChild(url);
  linkPreviewEl.appendChild(meta);
}

function renderPreviewError(url, message) {
  linkPreviewEl.className = "link-preview is-error";
  linkPreviewEl.hidden = false;
  linkPreviewEl.innerHTML = "";

  const meta = document.createElement("div");
  meta.className = "preview-meta";
  const kicker = document.createElement("span");
  kicker.className = "preview-kicker";
  kicker.textContent = "Preview unavailable";
  const title = document.createElement("p");
  title.className = "preview-title";
  title.textContent = hostnameFor(url);
  const desc = document.createElement("p");
  desc.className = "preview-desc";
  desc.textContent = message || "Beacon can still analyze this link.";
  meta.append(kicker, title, desc);
  linkPreviewEl.appendChild(meta);
}

async function fetchLinkPreview(url) {
  if (previewController) previewController.abort();
  previewController = new AbortController();
  renderPreviewLoading(url);

  try {
    const r = await fetch("/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: previewController.signal,
    });
    if (!r.ok) {
      let detail = "Beacon can still analyze this link.";
      try {
        const payload = await r.json();
        detail = payload.detail || detail;
      } catch {
        detail = await r.text() || detail;
      }
      throw new Error(detail);
    }
    renderPreview(await r.json());
  } catch (err) {
    if (err.name === "AbortError") return;
    renderPreviewError(url, err.message || String(err));
  } finally {
    previewController = null;
  }
}

function scheduleLinkPreview() {
  const url = firstUrl(inputEl.value.trim());
  if (!url) {
    hideLinkPreview();
    return;
  }
  if (url === previewUrl && !linkPreviewEl.hidden) return;
  previewUrl = url;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => fetchLinkPreview(url), PREVIEW_DEBOUNCE_MS);
}

inputEl.addEventListener("input", scheduleLinkPreview);
inputEl.addEventListener("paste", () => setTimeout(scheduleLinkPreview, 0));

document.addEventListener("click", (ev) => {
  const starter = ev.target.closest("[data-prompt]");
  if (!starter) return;
  inputEl.value = starter.dataset.prompt || "";
  inputEl.focus({ preventScroll: true });
  scheduleLinkPreview();
});

// ---------- Step 1: claim extraction ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = inputEl.value.trim();
  const file = imageEl.files[0];
  if (!raw && !file) {
    errorSec.textContent = "Type a claim, paste a URL, or attach an image.";
    showOnly(errorSec);
    return;
  }

  const body = {};
  if (raw) {
    if (URL_RE.test(raw)) body.url = raw;
    else body.text = raw;
  }
  if (file) body.image_b64 = await fileToBase64(file);

  loadingMsg.textContent = body.url
    ? "Manager fetching content + identifying claims…"
    : "Manager identifying claims…";
  startAgentPlan(extractionPlan(Boolean(body.url), Boolean(body.image_b64)));
  showOnly(loadingSec);
  submitBtn.disabled = true;

  try {
    const r = await fetch("/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const data = await r.json();
    completeAgentPlan();
    renderClaimsForReview(data.claims);
  } catch (err) {
    failAgentPlan();
    errorSec.textContent = err.message || String(err);
    showOnly(errorSec);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Step 1.5: claim review / edit ----------

function renderClaimsForReview(claims) {
  claimEditorsEl.innerHTML = "";
  if (!claims || claims.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "The Manager didn't identify any health claim in this input. You can add one manually.";
    claimEditorsEl.appendChild(empty);
  } else {
    claims.forEach((c, i) => claimEditorsEl.appendChild(claimEditor(c, i)));
  }
  claimCountEl.textContent = String(claims?.length || 0);
  showOnly(reviewSec);
}

function claimEditor(claim, idx) {
  const wrap = document.createElement("div");
  wrap.className = "claim-editor";
  wrap.dataset.tier = claim.tier || "main";
  wrap.dataset.language = claim.language || "en";
  wrap.dataset.domain = claim.domain || "";

  const header = document.createElement("div");
  header.className = "claim-editor-head";
  const tierBadge = document.createElement("span");
  tierBadge.className = `tier-badge tier-${claim.tier || "main"}`;
  tierBadge.textContent = claim.tier === "sub" ? "Sub-claim" : "Main claim";
  header.appendChild(tierBadge);
  if (claim.domain) {
    const dom = document.createElement("span");
    dom.className = "claim-domain";
    dom.textContent = claim.domain;
    header.appendChild(dom);
  }
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "claim-remove";
  removeBtn.textContent = "×";
  removeBtn.title = "Remove this claim";
  removeBtn.addEventListener("click", () => {
    wrap.remove();
    claimCountEl.textContent = String(claimEditorsEl.querySelectorAll(".claim-editor").length);
  });
  header.appendChild(removeBtn);

  const ta = document.createElement("textarea");
  ta.className = "claim-text-input";
  ta.rows = 2;
  ta.value = claim.text;
  ta.placeholder = "Health claim to fact-check…";

  wrap.appendChild(header);
  wrap.appendChild(ta);
  return wrap;
}

addClaimBtn.addEventListener("click", () => {
  const tier = claimEditorsEl.querySelectorAll(".claim-editor[data-tier='main']").length === 0
    ? "main" : "sub";
  claimEditorsEl.appendChild(claimEditor({ text: "", tier, language: "en" }));
  claimCountEl.textContent = String(claimEditorsEl.querySelectorAll(".claim-editor").length);
});

// ---------- Step 2: verify ----------

verifyBtn.addEventListener("click", async () => {
  const editors = Array.from(claimEditorsEl.querySelectorAll(".claim-editor"));
  const claims = editors
    .map((e) => ({
      text: e.querySelector("textarea").value.trim(),
      language: e.dataset.language || "en",
      domain: e.dataset.domain || null,
      tier: e.dataset.tier || "main",
    }))
    .filter((c) => c.text);

  if (claims.length === 0) {
    errorSec.textContent = "At least one claim is required.";
    showOnly(errorSec);
    return;
  }

  loadingMsg.textContent = `Dispatching ${claims.length} Investigator${claims.length === 1 ? "" : "s"}…`;
  startAgentPlan(verificationPlan(claims.length));
  showOnly(loadingSec);
  verifyBtn.disabled = true;

  try {
    const r = await fetch("/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claims }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    completeAgentPlan();
    renderResults(await r.json());
  } catch (err) {
    failAgentPlan();
    errorSec.textContent = err.message || String(err);
    showOnly(errorSec);
  } finally {
    verifyBtn.disabled = false;
  }
});

// ---------- Result rendering ----------

function sourceLi(s) {
  const li = document.createElement("li");
  const tag = document.createElement("span");
  tag.className = "src-tag";
  tag.textContent = s.agent;
  const a = document.createElement("a");
  a.href = s.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = s.title || s.url;
  li.appendChild(tag);
  li.appendChild(a);
  if (s.snippet) {
    const p = document.createElement("div");
    p.className = "snippet";
    p.textContent = s.snippet;
    li.appendChild(p);
  }
  return li;
}

function claimCard({ claim, verdict }) {
  const card = document.createElement("article");
  card.className = "claim-card";

  const header = document.createElement("div");
  header.className = "claim-header";
  const band = document.createElement("span");
  band.className = `band ${BAND_CLASS[verdict.band] || ""}`;
  band.textContent = verdict.band;
  if (claim.tier) {
    const tierBadge = document.createElement("span");
    tierBadge.className = `tier-badge tier-${claim.tier}`;
    tierBadge.textContent = claim.tier === "sub" ? "Sub" : "Main";
    header.appendChild(tierBadge);
  }
  const claimText = document.createElement("p");
  claimText.className = "claim-text";
  claimText.textContent = claim.text;
  header.appendChild(band);
  header.appendChild(claimText);
  card.appendChild(header);

  if (verdict.narrative) {
    const n = document.createElement("p");
    n.className = "narrative";
    n.textContent = verdict.narrative;
    card.appendChild(n);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const totalSources = (verdict.findings || []).reduce((acc, f) => acc + (f.sources?.length || 0), 0);
  meta.textContent = `score ${verdict.score} · ${totalSources} source${totalSources === 1 ? "" : "s"}${claim.domain ? " · " + claim.domain : ""}`;
  card.appendChild(meta);

  const det = document.createElement("details");
  det.open = totalSources > 0;
  const sum = document.createElement("summary");
  sum.textContent = `Sources (${totalSources})`;
  det.appendChild(sum);
  const ul = document.createElement("ul");
  ul.className = "sources-list";
  for (const f of verdict.findings || []) {
    for (const s of f.sources || []) ul.appendChild(sourceLi({ ...s, agent: f.agent }));
  }
  det.appendChild(ul);
  card.appendChild(det);

  return card;
}

function renderResults(payload) {
  claimCardsEl.innerHTML = "";
  const { results, elapsed_seconds } = payload;

  const summary = document.createElement("p");
  summary.className = "results-summary";
  summary.textContent = `${results.length} verdict${results.length === 1 ? "" : "s"} · ${elapsed_seconds}s`;
  claimCardsEl.appendChild(summary);

  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No verdicts produced — likely a rate-limit or model error. Check server logs.";
    claimCardsEl.appendChild(empty);
  } else {
    for (const r of results) claimCardsEl.appendChild(claimCard(r));
  }
  showOnly(resultSec);
}
