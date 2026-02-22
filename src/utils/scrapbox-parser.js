// Scrapboxの行を解釈してHTMLに変換
const R2_BASE_URL = 'https://pub-914d924a13a1433c85c0aedcd204e1ff.r2.dev/webp';

function convertToR2Url(originalUrl) {
  const match = originalUrl.match(/https:\/\/scrapbox\.io\/files\/([a-f0-9]+)\.[a-z]+/i);
  if (match) {
    return `${R2_BASE_URL}/${match[1]}.webp`;
  }
  return originalUrl;
}

export function parseScrapboxLine(text) {
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

  // 画像 [https://...画像URL]
  const imageMatch = text.match(/\[?(https:\/\/[^\s\]]+\.(?:png|jpg|jpeg|gif|webp))\]?/i);
  if (imageMatch) {
    const imgSrc = convertToR2Url(imageMatch[1]);
    return { type: 'image', html: `<img src="${imgSrc}" alt="画像" />` };
  }

  // インデント（リスト）
  const indentLevel = (text.match(/^\t+/) || [''])[0].length;
  if (indentLevel > 0) {
    const content = text.substring(indentLevel);
    const parsed = parseInlineElements(content);
    return { type: 'list', level: indentLevel, html: `<li style="margin-left: ${indentLevel * 20}px">${parsed}</li>` };
  }

  // 通常のテキスト
  const parsed = parseInlineElements(text);
  return { type: 'text', html: `<p>${parsed}</p>` };
}

// インライン要素の解釈（リンク、タグなど）
function parseInlineElements(text) {
  // [リンク]記法を処理
  text = text.replace(/\[([^\]]+?)\]/g, (match, content) => {
    // URLの場合
    if (content.startsWith('http')) {
      return `<a href="${content}" target="_blank" rel="noopener">${content}</a>`;
    }
    // 内部リンク（テキスト内の#をエンティティ化してタグ処理を防ぐ）
    const safeContent = content.replace(/#/g, '&#35;');
    return `<a href="/page/${encodeURIComponent(content)}" class="internal-link">${safeContent}</a>`;
  });

  // 通常のURLを処理（#タグより先に処理してURLフラグメントを保護）
  text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // #タグを処理（行頭またはスペース直後のみ。URL内の#や「C#」などは対象外）
  text = text.replace(/(^|\s)#([^\s<#]+)/g, '$1<span class="tag">#$2</span>');

  return text;
}

// 全行を解釈
export function parseScrapboxContent(lines) {
  return lines.map(line => parseScrapboxLine(line.text));
}