/* content.js — Reddit Thread Exporter
 * Injected on demand by popup.js via chrome.scripting.executeScript.
 * No network requests, no API calls, DOM-only.
 */

(function () {
  if (window.__rteContentLoaded) return;
  window.__rteContentLoaded = true;

  // ─── Utilities ─────────────────────────────────────────────────────────────

  function extractSubredditFromUrl() {
    const m = window.location.pathname.match(/\/r\/([^/]+)/);
    return m ? `r/${m[1]}` : "";
  }

  function attr(el, ...names) {
    if (!el) return "";
    for (const name of names) {
      const v = el.getAttribute(name);
      if (v !== null && v !== "") return v;
    }
    return "";
  }

  function text(el) {
    return el ? (el.innerText || el.textContent || "").trim() : "";
  }

  // ─── HTML → Markdown serializer ────────────────────────────────────────────

  function htmlToMarkdown(el) {
    if (!el) return "";

    function walk(node) {
      if (node.nodeType === 3 /* TEXT_NODE */) return node.textContent;
      if (node.nodeType !== 1 /* ELEMENT_NODE */) return "";

      const tag = node.tagName.toLowerCase();

      if (tag === "ul" || tag === "ol") {
        const items = [];
        node.childNodes.forEach((child) => {
          if (child.nodeType === 1 && child.tagName.toLowerCase() === "li") {
            const liText = Array.from(child.childNodes).map(walk).join("").trim();
            items.push(`- ${liText}`);
          }
        });
        return items.length ? items.join("\n") + "\n\n" : "";
      }

      const children = Array.from(node.childNodes).map(walk).join("");

      switch (tag) {
        case "p":         return children.trim() ? `${children.trim()}\n\n` : "";
        case "br":        return "\n";
        case "strong":
        case "b":         return `**${children}**`;
        case "em":
        case "i":         return `*${children}*`;
        case "del":
        case "s":         return `~~${children}~~`;
        case "sup":       return `^(${children})`;
        case "code":
          if (node.closest && node.closest("pre")) return children;
          return `\`${children.replace(/`/g, "\\`")}\``;
        case "pre":       return `\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
        case "a": {
          const href = node.getAttribute("href") || "";
          const full = href.startsWith("/") ? `https://www.reddit.com${href}` : href;
          const label = children.trim() || full;
          return `[${label}](${full})`;
        }
        case "blockquote": {
          const inner = children.trim();
          if (!inner) return "";
          return inner.split("\n").map((l) => `> ${l}`).join("\n") + "\n\n";
        }
        case "h1": return `# ${children.trim()}\n\n`;
        case "h2": return `## ${children.trim()}\n\n`;
        case "h3": return `### ${children.trim()}\n\n`;
        case "h4": return `#### ${children.trim()}\n\n`;
        case "h5": return `##### ${children.trim()}\n\n`;
        case "h6": return `###### ${children.trim()}\n\n`;
        case "hr": return `---\n\n`;
        case "li": return `- ${children.trim()}\n`;
        default:   return children;
      }
    }

    return walk(el).replace(/\n{3,}/g, "\n\n").trim();
  }

  // ─── Version detection ─────────────────────────────────────────────────────

  function detectVersion() {
    if (document.querySelector("shreddit-post")) return "shreddit";
    if (
      document.querySelector("#siteTable .thing") ||
      document.querySelector(".commentarea")
    ) return "old";
    if (
      document.querySelector("[data-test-id='post-content']") ||
      document.querySelector("._3xX726aBn29LDbsDtzr_6E")
    ) return "redesign";
    return "unknown";
  }

  // ─── Shreddit scraping ─────────────────────────────────────────────────────

  function scrapeShreddit() {
    const postEl = document.querySelector("shreddit-post");

    const title =
      attr(postEl, "post-title") ||
      text(document.querySelector("shreddit-title")) ||
      text(document.querySelector("h1")) ||
      document.title.replace(/ : .*$/, "").trim();

    const subreddit  = attr(postEl, "subreddit-prefixed-name") || extractSubredditFromUrl();
    const author     = attr(postEl, "author") || "[deleted]";
    const createdAt  = attr(postEl, "created-timestamp");
    const score      = attr(postEl, "score");
    const commentCount = attr(postEl, "comment-count");
    const postType   = attr(postEl, "post-type") || "text";
    const url        = window.location.href;

    let body = "";
    const textBodyEl =
      document.querySelector("shreddit-post-text-body") ||
      document.querySelector('[slot="text-body"]');
    if (textBodyEl) body = htmlToMarkdown(textBodyEl);
    if (!body && postEl) {
      const rteEl =
        postEl.querySelector(".text-neutral-content") ||
        postEl.querySelector('[data-post-click-location="text-body"]');
      if (rteEl) body = htmlToMarkdown(rteEl);
    }

    const images = [];
    const seen   = new Set();

    function addImage(src) {
      if (!src || seen.has(src)) return;
      let hostname = "", pathname = "";
      try {
        const u = new URL(src);
        hostname = u.hostname;
        pathname = u.pathname;
      } catch { return; }

      if (
        src.includes("emoji") ||
        src.includes("snoomoji") ||
        hostname === "styles.redditmedia.com" ||
        pathname.includes("/styles/") ||
        /(?:^|[/._\-])icon(?:[._\-/]|$)/i.test(pathname) ||
        /\d+x\d+\.(png|gif)$/.test(src)
      ) return;

      seen.add(src);
      images.push(src);
    }

    document
      .querySelectorAll("gallery-carousel img, [data-gallery-index] img")
      .forEach((img) => addImage(img.src || img.getAttribute("src")));

    if (postType === "image") {
      document
        .querySelectorAll(
          'shreddit-post img:not([slot="commentCountIcon"]):not([slot="upvoteIcon"])'
        )
        .forEach((img) => addImage(img.src));
    }

    document
      .querySelectorAll("media-lightbox-content img, shreddit-post-media-container img")
      .forEach((img) => addImage(img.src));

    const comments = scrapeShredditComments();

    return { title, subreddit, author, createdAt, score, commentCount,
             url, postType, body, images, comments };
  }

  function scrapeShredditComments() {
    const els  = document.querySelectorAll("shreddit-comment");
    const flat = [];

    els.forEach((el) => {
      const id =
        attr(el, "thingid") || attr(el, "comment-id") || attr(el, "id") || el.id || "";
      const author    = attr(el, "author") || "[deleted]";
      const createdAt = attr(el, "created-timestamp");
      const score     = attr(el, "score");
      const depth     = parseInt(attr(el, "depth") || "0", 10);

      let content = "";
      const slotEl =
        el.querySelector('[slot="comment"]') ||
        el.querySelector(".RichTextJSON-root") ||
        el.querySelector("p");
      if (slotEl) content = htmlToMarkdown(slotEl);

      flat.push({ id, author, createdAt, score, content, depth, replies: [] });
    });

    return buildCommentTree(flat);
  }

  // ─── Old Reddit scraping ───────────────────────────────────────────────────

  function scrapeOldReddit() {
    const thingEl = document.querySelector("#siteTable .thing");

    const title =
      text(thingEl?.querySelector("a.title") || document.querySelector("a.title")) ||
      document.title;

    const subreddit =
      text(
        thingEl?.querySelector(".subreddit") || document.querySelector(".subreddit")
      ) || extractSubredditFromUrl();

    const author =
      text(
        thingEl?.querySelector(".author") || document.querySelector(".author")
      ) || "[deleted]";

    const timeEl = thingEl?.querySelector("time") || document.querySelector(".thing time");
    const createdAt = timeEl?.getAttribute("datetime") || text(timeEl);

    const scoreEl =
      thingEl?.querySelector(".score.unvoted") || thingEl?.querySelector(".score");
    const score = attr(scoreEl, "title") || text(scoreEl);

    const commentCountEl = document.querySelector("a.comments[href*='comments']");
    const commentCount = text(commentCountEl).replace(/[^\d]/g, "");

    const url = window.location.href;

    const bodyEl = document.querySelector(".usertext-body .md, .expando .usertext-body .md");
    const body = bodyEl ? htmlToMarkdown(bodyEl) : "";

    const images = [];
    document
      .querySelectorAll(".expando img, .media-preview img, .post-image img")
      .forEach((img) => {
        if (img.src && !img.src.includes("emoji")) images.push(img.src);
      });

    const comments = scrapeOldRedditComments();

    return {
      title,
      subreddit: subreddit.startsWith("r/") ? subreddit : `r/${subreddit}`,
      author, createdAt, score, commentCount, url,
      postType: body ? "text" : images.length ? "image" : "link",
      body, images, comments,
    };
  }

  function scrapeOldRedditComments() {
    const rootListing =
      document.querySelector(".commentarea > .nestedlisting") ||
      document.querySelector(".commentarea .nestedlisting");

    if (!rootListing) return [];

    function parseCommentEl(el, depth) {
      const authorEl  = el.querySelector(":scope > .entry .author");
      const timeEl    = el.querySelector(":scope > .entry time");
      const scoreEl   =
        el.querySelector(":scope > .entry .score.unvoted") ||
        el.querySelector(":scope > .entry .score");
      const contentEl = el.querySelector(":scope > .entry .usertext-body .md");
      const id        = attr(el, "data-fullname") || el.id || "";

      const author    = text(authorEl) || "[deleted]";
      const createdAt = timeEl?.getAttribute("datetime") || text(timeEl);
      const score     = attr(scoreEl, "title") || text(scoreEl);
      const content   = contentEl ? htmlToMarkdown(contentEl) : "";

      const replies = [];
      el
        .querySelectorAll(":scope > .child > .listing > .comment:not(.deleted)")
        .forEach((child) => replies.push(parseCommentEl(child, depth + 1)));

      return { id, author, createdAt, score, content, depth, replies };
    }

    const result = [];
    rootListing
      .querySelectorAll(":scope > .comment:not(.deleted)")
      .forEach((el) => result.push(parseCommentEl(el, 0)));

    return result;
  }

  // ─── Reddit Redesign fallback ──────────────────────────────────────────────

  function scrapeRedesign() {
    const title =
      text(document.querySelector("[data-test-id='post-content'] h1")) ||
      text(document.querySelector("h1")) ||
      document.title;

    const subreddit = extractSubredditFromUrl();

    const authorEl = document.querySelector("[data-test-id='post-content'] a[href*='/user/']");
    const author   = text(authorEl).replace("u/", "") || "[deleted]";

    const timeEl   = document.querySelector("[data-test-id='post-content'] a time");
    const createdAt = timeEl?.getAttribute("datetime") || text(timeEl);

    const url      = window.location.href;

    const bodyEl   = document.querySelector("[data-test-id='post-content'] .RichTextJSON-root");
    const body     = bodyEl ? htmlToMarkdown(bodyEl) : "";

    const images = [];
    document
      .querySelectorAll("[data-test-id='post-content'] img")
      .forEach((img) => {
        if (img.src && !img.src.includes("emoji")) images.push(img.src);
      });

    const comments = scrapeRedesignComments();

    return {
      title, subreddit, author, createdAt,
      score: "", commentCount: "",
      url,
      postType: body ? "text" : images.length ? "image" : "link",
      body, images, comments,
    };
  }

  function scrapeRedesignComments() {
    const flat = [];

    document.querySelectorAll("[data-testid='comment']").forEach((el) => {
      const cssDepth = getComputedStyle(el).getPropertyValue("--comment-depth").trim();
      const depth    = parseInt(cssDepth || el.getAttribute("data-depth") || "0", 10) || 0;

      const authorEl  = el.querySelector("a[href*='/user/']");
      const author    = text(authorEl).replace("u/", "") || "[deleted]";
      const timeEl    = el.querySelector("a time");
      const createdAt = timeEl?.getAttribute("datetime") || "";
      const contentEl = el.querySelector(".RichTextJSON-root, .md");
      const content   = contentEl ? htmlToMarkdown(contentEl) : "";

      flat.push({ id: el.id || "", author, createdAt, score: "", content, depth, replies: [] });
    });

    return buildCommentTree(flat);
  }

  // ─── Comment tree builder ──────────────────────────────────────────────────

  function buildCommentTree(flat) {
    if (!flat.length) return [];
    const result = [];
    const stack  = [];

    for (const comment of flat) {
      const d = comment.depth;
      while (stack.length && stack[stack.length - 1].depth >= d) stack.pop();
      if (!stack.length) result.push(comment);
      else stack[stack.length - 1].comment.replies.push(comment);
      stack.push({ comment, depth: d });
    }
    return result;
  }

  // ─── Unified scrape entry point ────────────────────────────────────────────

  function scrapePageData() {
    const version = detectVersion();
    let data;

    if (version === "shreddit")      data = scrapeShreddit();
    else if (version === "old")      data = scrapeOldReddit();
    else if (version === "redesign") data = scrapeRedesign();
    else {
      data = scrapeShreddit();
      if (!data.title) data = scrapeOldReddit();
    }

    return data;
  }

  // ─── Message listener ──────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (request.action !== "scrape") return false;

    try {
      sendResponse({ success: true, data: scrapePageData() });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }

    return true;
  });

})();
