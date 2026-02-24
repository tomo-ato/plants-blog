// Scrapboxの行を解釈してHTMLに変換
import { KNOWN_TAGS } from './tags.js';

const R2_BASE_URL = 'https://pub-914d924a13a1433c85c0aedcd204e1ff.r2.dev/webp';

export function convertToR2Url(originalUrl) {
  const match = originalUrl.match(/https:\/\/scrapbox\.io\/files\/([a-f0-9]+)\.[a-z]+/i);
  if (match) {
    return `${R2_BASE_URL}/${match[1]}.webp`;
  }
  return originalUrl;
}

/**
 * 行がタグのみで構成されているか判定してタグ一覧を返す。
 * タグでない要素が含まれる場合は null を返す。
 */
function parseTagOnlyLine(text) {
  let remaining = text.trim();
  if (!remaining) return null;
  const lineTags = [];
  remaining = remaining.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (KNOWN_TAGS.has(content)) { lineTags.push(content); return ''; }
    return match;
  });
  remaining = remaining.replace(/(^|\s)#([^\s<#]+)/g, (_, _before, tag) => {
    lineTags.push(tag); return '';
  });
  return remaining.trim() === '' ? lineTags : null;
}

/**
 * 記事末尾のタグのみの行を抽出し、タグ一覧とそれを除いたコンテンツ行を返す。
 * 途中に空行があってもスキップして末尾タグを収集する。
 * @returns {{ tags: string[], contentLines: object[] }}
 */
export function extractTagsFromLines(lines) {
  // 末尾から走査：空行はスキップ、タグのみ行は収集、本文行が来たら停止
  let cutoff = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i].text.trim();
    if (!text) continue; // 空行は飛ばして継続
    const lineTags = parseTagOnlyLine(text);
    if (lineTags !== null) {
      cutoff = i; // この行も末尾タグ領域に含める
    } else {
      break; // 本文行に当たったので停止
    }
  }

  const seen = new Set();
  const tags = [];
  for (let i = cutoff; i < lines.length; i++) {
    const lineTags = parseTagOnlyLine(lines[i].text.trim());
    if (!lineTags) continue;
    for (const tag of lineTags) {
      if (!seen.has(tag)) { tags.push(tag); seen.add(tag); }
    }
  }

  return { tags, contentLines: lines.slice(0, cutoff) };
}

export function parseScrapboxLine(text, titleToId = {}, titleToImage = {}) {
  // 空行
  if (!text.trim()) {
    return { type: 'empty', html: '<br>' };
  }

  // 見出し [* テキスト]
  const headingMatch = text.match(/^\[?\*+\s+(.+?)\]?$/);
  if (headingMatch) {
    const level = text.match(/\*/g).length;
    return { type: 'heading', html: `<h${Math.min(level + 1, 6)}>${headingMatch[1]}</h${Math.min(level + 1, 6)}>` };
  }

  // 画像 [https://...画像URL] ※行全体が画像URLの場合のみブロック画像扱い
  const imageMatch = text.trim().match(/^\[?(https:\/\/[^\s\]]+\.(?:png|jpg|jpeg|gif|webp))\]?$/i);
  if (imageMatch) {
    const imgSrc = convertToR2Url(imageMatch[1]);
    return { type: 'image', html: `<img src="${imgSrc}" alt="画像" />` };
  }

  // 引用 > テキスト
  if (text.trimStart().startsWith('>')) {
    const quoteText = text.trimStart().replace(/^>\s?/, '');
    const parsed = parseInlineElements(quoteText, titleToId, titleToImage);
    return { type: 'quote', html: `<blockquote>${parsed}</blockquote>` };
  }

  // インデント（リスト）
  const indentLevel = (text.match(/^\t+/) || [''])[0].length;
  if (indentLevel > 0) {
    const content = text.substring(indentLevel);
    const parsed = parseInlineElements(content, titleToId, titleToImage);
    return { type: 'list', level: indentLevel, html: `<li style="margin-left: ${indentLevel * 20}px">${parsed}</li>` };
  }

  // 通常のテキスト
  const parsed = parseInlineElements(text, titleToId, titleToImage);
  return { type: 'text', html: `<p>${parsed}</p>` };
}

// インライン要素の解釈（リンク、タグなど）
function parseInlineElements(text, titleToId = {}, titleToImage = {}) {
  // [リンク]記法を処理
  text = text.replace(/\[([^\]]+?)\]/g, (_match, content) => {
    // URLの場合
    if (content.startsWith('http')) {
      // 画像URLはインラインアイコンとして表示
      if (/\.(png|jpg|jpeg|gif|webp)$/i.test(content)) {
        return `<img src="${convertToR2Url(content)}" class="scrapbox-icon" alt="画像" />`;
      }
      return `<a href="${content}" target="_blank" rel="noopener">${content}</a>`;
    }
    // アイコン記法 [XXX.icon] or [XXX.icon*N]
    const iconMatch = content.match(/^(.+?)\.icon(?:\*(\d+))?$/);
    if (iconMatch) {
      const pageName = iconMatch[1];
      const rawUrl = titleToImage[pageName];
      if (!rawUrl) return '';
      const iconUrl = convertToR2Url(rawUrl);
      return `<img src="${iconUrl}" class="scrapbox-icon" alt="${pageName}" />`;
    }
    // KNOWN_TAGSに含まれる場合は明示的にタグ扱い（#付きで表示）
    const safeContent = content.replace(/#/g, '&#35;');
    if (KNOWN_TAGS.has(content.toLowerCase())) {
      return `<a href="/tag?q=${encodeURIComponent(content.toLowerCase())}" class="tag">#${safeContent}</a>`;
    }
    // 内部リンク：タイトル→IDで解決。存在しないページは#付きタグ扱い
    const pageId = titleToId[content];
    if (pageId) {
      return `<a href="/page/${pageId}" class="internal-link">${safeContent}</a>`;
    }
    return `<a href="/tag?q=${encodeURIComponent(content.toLowerCase())}" class="tag">#${safeContent}</a>`;
  });

  // 通常のURLを処理（HTML属性内のURLは対象外、#タグより先に処理）
  text = text.replace(/(?<![="'])(https?:\/\/[^\s<"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // #タグを処理（行頭またはスペース直後のみ。URL内の#や「C#」などは対象外）
  text = text.replace(/(^|\s)#([^\s<#]+)/g, (_, before, tag) =>
    `${before}<a href="/tag?q=${encodeURIComponent(tag)}" class="tag">#${tag}</a>`);

  return text;
}

// 全行を解釈
export function parseScrapboxContent(lines, titleToId = {}, titleToImage = {}) {
  const items = [];
  for (const line of lines) {
    const item = parseScrapboxLine(line.text, titleToId, titleToImage);

    // 直前も引用行 → 同じ blockquote にまとめる
    if (item.type === 'quote' && items.length > 0 && items[items.length - 1].type === 'quote') {
      const prev = items.pop();
      const prevInner = prev.html.replace(/^<blockquote>/, '').replace(/<\/blockquote>$/, '');
      const currInner = item.html.replace(/^<blockquote>/, '').replace(/<\/blockquote>$/, '');
      items.push({ type: 'quote', html: `<blockquote>${prevInner}<br>${currInner}</blockquote>` });
    }

    // 直前が画像でテキスト行 → figure + figcaption にまとめる
    else if (
      item.type === 'text' &&
      items.length > 0 &&
      items[items.length - 1].type === 'image'
    ) {
      const prev = items.pop();
      const captionHtml = item.html.replace(/^<p>/, '').replace(/<\/p>$/, '');
      items.push({
        type: 'figure',
        html: `<figure>${prev.html}<figcaption>${captionHtml}</figcaption></figure>`,
      });
    } else {
      items.push(item);
    }
  }
  return items;
}