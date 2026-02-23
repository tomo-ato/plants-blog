// Scrapboxの行を解釈してHTMLに変換
import { KNOWN_TAGS } from './tags.js';

const R2_BASE_URL = 'https://pub-914d924a13a1433c85c0aedcd204e1ff.r2.dev/webp';

function convertToR2Url(originalUrl) {
  const match = originalUrl.match(/https:\/\/scrapbox\.io\/files\/([a-f0-9]+)\.[a-z]+/i);
  if (match) {
    return `${R2_BASE_URL}/${match[1]}.webp`;
  }
  return originalUrl;
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
  text = text.replace(/\[([^\]]+?)\]/g, (match, content) => {
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
    if (KNOWN_TAGS.has(content)) {
      return `<a href="/tag?q=${encodeURIComponent(content)}" class="tag">#${safeContent}</a>`;
    }
    // 内部リンク：タイトル→IDで解決。存在しないページは#付きタグ扱い
    const pageId = titleToId[content];
    if (pageId) {
      return `<a href="/page/${pageId}" class="internal-link">${safeContent}</a>`;
    }
    return `<a href="/tag?q=${encodeURIComponent(content)}" class="tag">#${safeContent}</a>`;
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

    // 直前が画像でテキスト行 → figure + figcaption にまとめる
    if (
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