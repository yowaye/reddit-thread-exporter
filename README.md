<div align="center">

<img src="icons/icon128.png" width="80" alt="Reddit Thread Exporter" />

# Reddit 帖子导出工具

**一键提取 Reddit 帖子完整内容，导出为 Markdown 文件**

[![版本](https://img.shields.io/github/v/release/yowaye/reddit-thread-exporter?label=版本&color=ff4500)](https://github.com/yowaye/reddit-thread-exporter/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/)

[中文](#中文) · [English](#english)

</div>

---

## 中文

### 简介

Reddit Thread Exporter 是一款 Chrome 扩展，能够将任意 Reddit 帖子（含正文、评论、图片链接）一键导出为结构清晰的 Markdown 文件，也可直接复制到剪贴板。

**核心特点：**
- 纯 DOM 读取，不发送任何网络请求
- 所有数据留在本地，不上传任何内容
- 仅在用户主动点击时访问页面，无后台权限

---

### 功能特性

| 功能 | 说明 |
|------|------|
| 导出 Markdown | 生成结构化 `.md` 文件，包含标题、元数据表格、正文、评论 |
| 复制到剪贴板 | 无需保存文件，直接复制 Markdown 内容 |
| 包含图片链接 | 自动提取帖子中的图片 URL，以 Markdown 图片语法写入 |
| 包含评论 | 导出全部已加载的评论内容 |
| 保留评论层级 | 用引用块（`>`）还原评论的嵌套层级关系 |
| 导出预览 | 导出/复制后在弹窗内预览前 2000 字符 |
| 中英文界面 | 支持中文 / English 界面切换，跟随浏览器语言自动选择 |
| 5 分钟缓存 | 同一帖子 5 分钟内重复操作直接读缓存，无需重复解析 |

---

### 支持的 Reddit 版本

- `www.reddit.com` — 新版 Shreddit（当前主流版本）
- `old.reddit.com` — 经典旧版界面
- `new.reddit.com` / `sh.reddit.com` — 其他变体域名

---

### 安装方法

#### 方法一：从 GitHub Releases 安装（推荐）

1. 前往 [Releases 页面](https://github.com/yowaye/reddit-thread-exporter/releases) 下载最新版本的 `.zip` 文件
2. 将 `.zip` 解压到本地任意文件夹
3. 打开 Chrome，地址栏输入 `chrome://extensions/`
4. 右上角开启 **开发者模式**
5. 点击 **加载已解压的扩展程序**，选择解压后的文件夹

#### 方法二：从源码安装（开发者）

```bash
git clone https://github.com/yowaye/reddit-thread-exporter.git
```

然后按方法一第 3–5 步操作，选择克隆下来的文件夹即可。

---

### 使用方法

1. 在 Chrome 中打开任意 Reddit 帖子详情页  
   （URL 格式为 `reddit.com/r/*/comments/*`）
2. 点击右上角扩展图标，打开弹窗
3. 根据需要勾选选项：
   - **包含图片链接** — 导出帖子中的图片
   - **包含评论** — 导出当前页面已加载的评论
   - **保留评论层级** — 用引用块还原嵌套结构
4. 点击 **导出 Markdown** 保存文件，或 **复制到剪贴板** 直接使用

---

### 导出格式示例

```markdown
# 帖子标题

| 字段 | 值 |
|------|-----|
| Subreddit | r/example |
| 作者 | u/username |
| 发布时间 | 2025/01/01 12:00 |
| 评分 | 1234 |
| 评论数 | 56 |
| 链接 | https://www.reddit.com/r/... |

---

## 正文

帖子正文内容……

## 图片

![图片 1](https://i.redd.it/example.jpg)

## 评论

### u/commenter1  <sub>234 分 · 2025/01/01 13:00</sub>

评论内容……

> ### u/commenter2  <sub>56 分 · 2025/01/01 13:30</sub>
>
> 回复内容……
```

---

### 隐私与安全

- **零网络请求**：扩展仅读取当前页面的 DOM，不与任何外部服务器通信
- **零后台权限**：不使用 `content_scripts` 静态注入，仅在用户点击操作时通过 `activeTab` + `scripting` 权限访问当前标签页
- **数据留本地**：所有解析结果仅存储在浏览器本地 `chrome.storage.local`，不上传

所需权限说明：

| 权限 | 用途 |
|------|------|
| `activeTab` | 点击时访问当前标签页 |
| `scripting` | 按需注入解析脚本 |
| `downloads` | 保存导出的 `.md` 文件 |
| `storage` | 本地缓存解析结果（5 分钟有效） |

---

### 常见问题

**Q：点击导出没有反应？**  
A：请确认当前页面是 Reddit 帖子详情页（URL 中含 `/comments/`），列表页和主页不支持。

**Q：评论不完整？**  
A：扩展只能导出页面上已加载的评论。Reddit 默认折叠部分评论，建议先展开需要的内容再导出。

**Q：图片链接失效？**  
A：Reddit 的图片链接带有时效性（CDN 签名），建议导出后尽快使用。

---

### 版本历史

查看 [CHANGELOG / Releases](https://github.com/yowaye/reddit-thread-exporter/releases)

---

### 开源协议

[MIT License](LICENSE) · 由 [YoWaye](https://yowaye.com) 开发

---
---

## English

### Introduction

Reddit Thread Exporter is a Chrome extension that exports any Reddit thread — including post body, comments, and images — to a clean Markdown file with one click. You can also copy directly to the clipboard.

**Key highlights:**
- Pure DOM scraping, zero network requests
- All data stays local, nothing is uploaded
- Only accesses the page when you explicitly click — no background permissions

---

### Features

| Feature | Description |
|---------|-------------|
| Export Markdown | Generates a structured `.md` file with title, metadata table, body, and comments |
| Copy to Clipboard | Copy Markdown content directly without saving a file |
| Include Images | Extracts image URLs and writes them as Markdown image syntax |
| Include Comments | Exports all comments currently loaded on the page |
| Preserve Hierarchy | Reconstructs nested comment threads using blockquotes (`>`) |
| Export Preview | Shows a preview of the first 2,000 characters after export/copy |
| Bilingual UI | Chinese / English interface, auto-detected from browser language |
| 5-minute Cache | Re-uses parsed data for 5 minutes so repeated exports are instant |

---

### Supported Reddit Versions

- `www.reddit.com` — new Shreddit layout (current default)
- `old.reddit.com` — classic old Reddit
- `new.reddit.com` / `sh.reddit.com` — other subdomain variants

---

### Installation

#### Option 1: Install from GitHub Releases (recommended)

1. Go to the [Releases page](https://github.com/yowaye/reddit-thread-exporter/releases) and download the latest `.zip`
2. Unzip it to any local folder
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable **Developer mode** (top-right toggle)
5. Click **Load unpacked** and select the unzipped folder

#### Option 2: Install from source (developers)

```bash
git clone https://github.com/yowaye/reddit-thread-exporter.git
```

Then follow steps 3–5 above, selecting the cloned folder.

---

### How to Use

1. Open any Reddit thread in Chrome  
   (URL must match `reddit.com/r/*/comments/*`)
2. Click the extension icon in the toolbar to open the popup
3. Choose your export options:
   - **Include Images** — embed image links from the post
   - **Include Comments** — export all loaded comments
   - **Preserve Hierarchy** — use blockquotes to show nested replies
4. Click **Export Markdown** to save a file, or **Copy to Clipboard** to use directly

---

### Export Format Example

```markdown
# Post Title

| Field | Value |
|-------|-------|
| Subreddit | r/example |
| Author | u/username |
| Posted | 01/01/2025 12:00 |
| Score | 1234 |
| Comments | 56 |
| URL | https://www.reddit.com/r/... |

---

## Content

Post body text…

## Images

![Image 1](https://i.redd.it/example.jpg)

## Comments

### u/commenter1  <sub>234 pts · 01/01/2025 13:00</sub>

Comment text…

> ### u/commenter2  <sub>56 pts · 01/01/2025 13:30</sub>
>
> Reply text…
```

---

### Privacy & Security

- **Zero network requests**: The extension reads only the current page's DOM and never contacts any external server
- **Zero background permissions**: No static `content_scripts` injection — the page is only accessed via `activeTab` + `scripting` when you click
- **Local data only**: Parsed results are stored in `chrome.storage.local` and never uploaded anywhere

Permission breakdown:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the current tab on click |
| `scripting` | Inject the parsing script on demand |
| `downloads` | Save the exported `.md` file |
| `storage` | Cache parsed data locally (5-minute TTL) |

---

### FAQ

**Q: Nothing happens when I click Export?**  
A: Make sure you're on a Reddit thread page (URL must contain `/comments/`). List pages and the home page are not supported.

**Q: Comments are incomplete?**  
A: The extension can only export comments that are already loaded in the DOM. Reddit collapses some threads by default — expand them before exporting.

**Q: Image links don't work after a while?**  
A: Reddit CDN image URLs contain time-limited signatures. Use exported image links as soon as possible.

---

### Changelog

See [Releases](https://github.com/yowaye/reddit-thread-exporter/releases)

---

### License

[MIT License](LICENSE) · Built by [YoWaye](https://yowaye.com)
