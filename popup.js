/* popup.js — Reddit Thread Exporter · YoWaye
 * Flow: i18n init → (optional cache hit) → live scrape → export / copy
 * No network requests. All data stays local.
 */

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const btnExport       = document.getElementById("btn-export");
const btnCopy         = document.getElementById("btn-copy");
const btnLang         = document.getElementById("btn-lang");
const statusEl        = document.getElementById("status");
const statusIcon      = document.getElementById("status-icon");
const statusText      = document.getElementById("status-text");
const optImages       = document.getElementById("opt-images");
const optComments     = document.getElementById("opt-comments");
const optHierarchy    = document.getElementById("opt-hierarchy");
const hierarchyRow    = document.getElementById("hierarchy-row");
const previewSect     = document.getElementById("preview-section");
const previewPre      = document.getElementById("preview-content");
const btnClosePreview = document.getElementById("btn-close-preview");

// ─── i18n system ──────────────────────────────────────────────────────────────

let _msgs   = {};
let _locale = "zh_CN";

const LANG_KEY = "rte_lang";

function t(key, ...args) {
  const entry = _msgs[key];
  if (!entry) return key;
  let s = entry.message;
  args.forEach((a, i) => { s = s.replace(`$${i + 1}`, String(a)); });
  return s;
}

function _getLangPref() {
  return new Promise(resolve =>
    chrome.storage.local.get(LANG_KEY, r => resolve(r[LANG_KEY] || "auto"))
  );
}

function _setLangPref(val) {
  return new Promise(resolve =>
    chrome.storage.local.set({ [LANG_KEY]: val }, resolve)
  );
}

async function initI18n() {
  const pref = await _getLangPref();
  const ui   = chrome.i18n.getUILanguage().toLowerCase();

  _locale = (pref === "auto")
    ? (ui.startsWith("zh") ? "zh_CN" : "en")
    : (pref === "zh" ? "zh_CN" : "en");

  const url  = chrome.runtime.getURL(`_locales/${_locale}/messages.json`);
  const resp = await fetch(url);
  _msgs      = await resp.json();

  _applyI18nToDOM();
  _updateLangBtn();
}

function _applyI18nToDOM() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const v = t(el.getAttribute("data-i18n"));
    if (v) el.textContent = v;
  });
}

function _updateLangBtn() {
  if (_locale === "zh_CN") {
    btnLang.textContent = "EN";
    btnLang.title       = "Switch to English";
  } else {
    btnLang.textContent = "中";
    btnLang.title       = "切换到中文";
  }
}

btnLang.addEventListener("click", async () => {
  const next = _locale === "zh_CN" ? "en" : "zh";
  await _setLangPref(next);
  location.reload();
});

// ─── Status helpers ───────────────────────────────────────────────────────────

function setStatus(type, icon, msg) {
  statusEl.className    = `status status-${type}`;
  statusIcon.textContent = icon;
  statusText.textContent = msg;
}

// ─── URL validation ───────────────────────────────────────────────────────────

const ALLOWED_HOSTS = new Set([
  "www.reddit.com",
  "reddit.com",
  "old.reddit.com",
  "sh.reddit.com",
  "new.reddit.com",
]);

function isRedditThreadUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!ALLOWED_HOSTS.has(u.hostname)) return false;
    return /^\/r\/[^/]+\/comments\/[^/]+/.test(u.pathname);
  } catch {
    return false;
  }
}

// ─── URL normalization ────────────────────────────────────────────────────────

function normalizeRedditUrl(rawUrl) {
  try {
    const u    = new URL(rawUrl);
    const path = u.pathname.replace(/\/$/, "") || "/";
    return u.origin + path;
  } catch {
    return rawUrl;
  }
}

function buildCacheKeyForUrl(rawUrl) {
  return "rte:" + normalizeRedditUrl(rawUrl);
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedScrape(rawUrl) {
  return new Promise(resolve => {
    const key = buildCacheKeyForUrl(rawUrl);
    chrome.storage.local.get(key, r => resolve(r[key] || null));
  });
}

function isCacheEntry(entry) {
  return (
    entry &&
    entry.version === 1 &&
    entry.data &&
    typeof entry.data.title === "string" &&
    entry.data.title.trim() !== ""
  );
}

function cacheAgeMs(entry) {
  try { return Date.now() - new Date(entry.scrapedAt).getTime(); }
  catch { return Infinity; }
}

function fmtAge(ms) {
  const sec = Math.round(ms / 1000);
  return sec < 60 ? t("ageSeconds", sec) : t("ageMinutes", Math.round(sec / 60));
}

function updateCache(rawUrl, data) {
  if (!data || !data.title) return Promise.resolve();
  const key   = buildCacheKeyForUrl(rawUrl);
  const entry = {
    version:   1,
    url:       normalizeRedditUrl(rawUrl),
    scrapedAt: new Date().toISOString(),
    data:      data,
  };
  return new Promise(resolve => chrome.storage.local.set({ [key]: entry }, resolve));
}

// ─── Options wiring ───────────────────────────────────────────────────────────

optComments.addEventListener("change", () => {
  hierarchyRow.classList.toggle("disabled", !optComments.checked);
});

// ─── Data retrieval ───────────────────────────────────────────────────────────

async function sendScrapeMessage(tabId) {
  // Inject content script on demand — requires only activeTab + scripting,
  // no host_permissions or content_scripts matches needed.
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: "scrape" }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(t("errorNotReady")));
        return;
      }
      if (!response || !response.success) {
        reject(new Error(response?.error || t("errorParseFailed")));
        return;
      }
      resolve(response.data);
    });
  });
}

async function getDataForExport(tabId, tabUrl) {
  const entry = await getCachedScrape(tabUrl);
  if (isCacheEntry(entry) && cacheAgeMs(entry) <= CACHE_TTL_MS) {
    return { data: entry.data, fromCache: true };
  }
  const data = await sendScrapeMessage(tabId);
  return { data, fromCache: false };
}

// ─── Markdown generation ──────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const localeCode = _locale === "zh_CN" ? "zh-CN" : "en-US";
    return d.toLocaleString(localeCode, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function slugify(title) {
  const slug = (title || "reddit-thread")
    .replace(/[^\w一-龥\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .substring(0, 80)
    .replace(/^-+|-+$/g, "");
  return slug || "reddit-thread";
}

function generateMarkdown(data, opts) {
  const { includeImages, includeComments, preserveHierarchy } = opts;
  const lines = [];

  lines.push(`# ${data.title}`);
  lines.push("");

  lines.push(`| ${t("mdField")} | ${t("mdValue")} |`);
  lines.push("|------|-----|");
  lines.push(`| Subreddit | ${data.subreddit} |`);
  lines.push(`| ${t("mdAuthor")} | u/${data.author} |`);
  if (data.createdAt)    lines.push(`| ${t("mdDate")} | ${formatDate(data.createdAt)} |`);
  if (data.score)        lines.push(`| ${t("mdScore")} | ${data.score} |`);
  if (data.commentCount) lines.push(`| ${t("mdCommentCount")} | ${data.commentCount} |`);
  lines.push(`| ${t("mdLink")} | ${data.url} |`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (data.body && data.body.trim()) {
    lines.push(`## ${t("mdBody")}`);
    lines.push("");
    lines.push(data.body.trim());
    lines.push("");
  }

  if (includeImages && data.images?.length > 0) {
    lines.push(`## ${t("mdImages")}`);
    lines.push("");
    data.images.forEach((src, i) => {
      lines.push(`![${t("mdImageAlt")} ${i + 1}](${src})`);
      lines.push("");
    });
  }

  if (includeComments && data.comments?.length > 0) {
    lines.push(`## ${t("mdComments")}`);
    lines.push("");

    function renderComment(comment, depth) {
      const hashes = "#".repeat(Math.min(depth + 3, 6));
      let header   = `${hashes} u/${comment.author}`;
      const meta   = [];
      if (comment.score)     meta.push(`${comment.score} ${t("mdScoreUnit")}`);
      if (comment.createdAt) meta.push(formatDate(comment.createdAt));
      if (meta.length) header += `  <sub>${meta.join(" · ")}</sub>`;
      lines.push(header);
      lines.push("");

      if (comment.content?.trim()) {
        if (preserveHierarchy && depth > 0) {
          const quote = "> ".repeat(depth);
          comment.content.trim().split("\n").forEach(l => {
            lines.push(l.trim() ? `${quote}${l.trim()}` : ">");
          });
        } else {
          comment.content.trim().split("\n").forEach(l => lines.push(l));
        }
        lines.push("");
      }

      comment.replies?.forEach(r =>
        renderComment(r, preserveHierarchy ? depth + 1 : 0)
      );
    }

    data.comments.forEach(c => renderComment(c, 0));
  }

  return lines.join("\n");
}

// ─── Download ─────────────────────────────────────────────────────────────────

function downloadMarkdown(md, title) {
  const filename = `${slugify(title)}.md`;
  const blob     = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url      = URL.createObjectURL(blob);

  chrome.downloads.download({ url, filename, saveAs: false }, downloadId => {
    URL.revokeObjectURL(url);
    if (chrome.runtime.lastError || downloadId === undefined) {
      const detail = chrome.runtime.lastError?.message || "";
      setStatus("error", "❌", `${t("errorDownloadFailed")}${detail ? ": " + detail : ""}`);
    } else {
      setStatus("success", "✅", t("statusSaved", filename));
      showPreview(md);
    }
  });
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────

async function copyToClipboard(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value          = txt;
    ta.style.position = "fixed";
    ta.style.opacity  = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function showPreview(md) {
  const suffix = md.length > 2000 ? "\n" + t("previewTruncated") : "";
  previewPre.textContent = md.substring(0, 2000) + suffix;
  previewSect.classList.remove("hidden");
}

btnClosePreview.addEventListener("click", () => {
  previewSect.classList.add("hidden");
});

// ─── Main export flow ─────────────────────────────────────────────────────────

function getOptions() {
  return {
    includeImages:     optImages.checked,
    includeComments:   optComments.checked,
    preserveHierarchy: optComments.checked && optHierarchy.checked,
  };
}

function setButtonsDisabled(disabled) {
  btnExport.disabled = disabled;
  btnCopy.disabled   = disabled;
}

async function runExport(mode) {
  setButtonsDisabled(true);
  setStatus("loading", "⏳", t("statusLoading"));
  previewSect.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id)                         throw new Error(t("errorNoTab"));
    if (!isRedditThreadUrl(tab.url || "")) throw new Error(t("errorNotReddit"));

    const { data, fromCache } = await getDataForExport(tab.id, tab.url);
    if (!data?.title)                     throw new Error(t("errorNoTitle"));

    if (!fromCache) updateCache(tab.url, data);

    const md = generateMarkdown(data, getOptions());

    if (mode === "export") {
      downloadMarkdown(md, data.title);
    } else {
      const ok = await copyToClipboard(md);
      if (ok) {
        setStatus("copy", "📋", t("statusCopied", md.length.toLocaleString()));
        showPreview(md);
      } else {
        setStatus("error", "❌", t("errorCopyFailed"));
      }
    }
  } catch (err) {
    setStatus("error", "❌", err.message);
  } finally {
    setButtonsDisabled(false);
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

btnExport.addEventListener("click", () => runExport("export"));
btnCopy.addEventListener("click",   () => runExport("copy"));

// ─── Init ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await initI18n();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab?.url || "";

    if (!isRedditThreadUrl(tabUrl)) {
      setStatus("idle", "ℹ️", t("statusNotReddit"));
      setButtonsDisabled(true);
      return;
    }

    const entry = await getCachedScrape(tabUrl);
    if (isCacheEntry(entry) && cacheAgeMs(entry) <= CACHE_TTL_MS) {
      setStatus("cache", "⚡", t("statusCached", fmtAge(cacheAgeMs(entry))));
    } else {
      setStatus("idle", "⬜", t("statusReady"));
    }
  } catch {
    // Silent on restricted pages (chrome://, file://, etc.)
  }
})();
