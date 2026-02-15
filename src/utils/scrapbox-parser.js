// Scrapboxの行を解釈してHTMLに変換
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
    return { type: 'image', html: `<img src="${imageMatch[1]}" alt="画像" />` };
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
    // 内部リンク
    return `<a href="/page/${encodeURIComponent(content)}" class="internal-link">${content}</a>`;
  });

  // #タグを処理
  text = text.replace(/#([a-zA-Z0-9_]+)/g, '<span class="tag">#$1</span>');

  // 通常のURLを処理
  text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  return text;
}

// 全行を解釈
export function parseScrapboxContent(lines) {
  return lines.map(line => parseScrapboxLine(line.text));
}