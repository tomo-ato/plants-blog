// Scrapboxの全ページをスキャンして以下を自動生成するスクリプト
//   src/utils/tags.js        … パーサーが参照するタグ一覧
//   public/tag-index.json   … タグ検索ページが参照するインデックス
//
// npm run build の前に自動実行される（package.json の prebuild）
// 手動実行: npm run sync-tags

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT = 'tomohirotsuji-plants';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAGS_FILE = path.resolve(__dirname, '../src/utils/tags.js');
const INDEX_FILE = path.resolve(__dirname, '../public/tag-index.json');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function main() {
  // ページ一覧を取得
  process.stdout.write('ページ一覧を取得中... ');
  const { pages } = await fetchJson(
    `https://scrapbox.io/api/pages/${PROJECT}?limit=1000`
  );
  console.log(`${pages.length}件`);

  const titleSet = new Set(pages.map((p) => p.title));

  // タグ → [{id, title}] のマップを構築
  const tagIndex = {};

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    process.stdout.write(`\r解析中... ${i + 1}/${pages.length} (${page.title})`);

    const pageData = await fetchJson(
      `https://scrapbox.io/api/pages/${PROJECT}/${encodeURIComponent(page.title)}`
    );

    const tagsInPage = new Set();

    for (const line of pageData.lines || []) {
      const text = line.text;

      // #tag を抽出（URLや「C#」などは除外）
      for (const m of text.matchAll(/(^|\s)#([^\s<#\]\[]+)/g)) {
        tagsInPage.add(m[2]);
      }

      // 疎通していない [link] を抽出
      for (const m of text.matchAll(/\[([^\]]+)\]/g)) {
        const inner = m[1];
        if (inner.startsWith('http')) continue;           // 外部URL
        if (/^\*+(\s|$)/.test(inner)) continue;           // 見出し [* ...]
        if (/^[\/\-\+\~](\s|$)/.test(inner)) continue;  // 装飾記法
        if (/^.+\.icon(\*\d+)?$/.test(inner)) continue;  // アイコン
        if (titleSet.has(inner)) continue;                // 存在するページ
        tagsInPage.add(inner);
      }
    }

    for (const tag of tagsInPage) {
      if (!tagIndex[tag]) tagIndex[tag] = [];
      tagIndex[tag].push({ id: page.id, title: page.title });
    }
  }

  console.log(''); // 改行

  // tags.js を書き出す
  const allTags = Object.keys(tagIndex).sort();
  const tagLines = allTags.map((t) => `  '${t.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`).join('\n');
  const tagsContent =
    `// scripts/sync-tags.js で自動生成 - 手動編集不要\n` +
    `// npm run sync-tags または npm run build で更新\n` +
    `export const KNOWN_TAGS = new Set([\n${tagLines}\n]);\n`;

  fs.writeFileSync(TAGS_FILE, tagsContent, 'utf-8');
  console.log(`tags.js: ${allTags.length}件のタグを書き込みました`);

  // public/tag-index.json を書き出す
  fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(tagIndex), 'utf-8');
  console.log(`tag-index.json: ${allTags.length}タグ、${pages.length}ページを書き込みました`);
}

main().catch((err) => {
  console.error('\nエラー:', err.message);
  process.exit(1);
});
