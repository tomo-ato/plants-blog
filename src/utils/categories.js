// ページタイトルからカテゴリ・パンくず情報を返すユーティリティ

// ビルド時にページ生成をスキップするタイトル
export const EXCLUDED_PAGES = new Set([
  'Cosenseの使い方',
]);

// Tillandsia の親種ページ定義
// prefixes: 子ページタイトルが startsWith で一致するパターン
export const TILLANDSIA_PARENTS = [
  {
    title: 'Tillandsia capillaris',
    prefixes: ['Tillandsia capillaris'],
  },
  {
    title: 'Tillandsia minutiflora (bryoides)',
    prefixes: ['Tillandsia minutiflora', 'Tillandsia bryoides', 'Tillandsia aff. bryoides'],
  },
  {
    title: 'Tillandsia loliacea',
    prefixes: ['Tillandsia loliacea'],
  },
  {
    title: 'Tillandsia pedicellata',
    prefixes: ['Tillandsia pedicellata'],
  },
  {
    title: 'Tillandsia tricholepis',
    prefixes: ['Tillandsia tricholepis'],
  },
];

/**
 * ページタイトルからカテゴリを返す
 * @returns {{ genus: string|null, parentTitle: string|null }}
 */
export function getCategory(title) {
  if (EXCLUDED_PAGES.has(title)) return { genus: null, parentTitle: null };
  if (title === 'Tomo_at') return { genus: 'about', parentTitle: null };
  if (title === 'READ ME（目次ともいう）') return { genus: null, parentTitle: null };
  if (title.startsWith('【memo】')) return { genus: 'article', parentTitle: null };

  // 【更新停止】などのステータスプレフィクスを除去してジャンル判定
  const effectiveTitle = title.replace(/^【[^】]+】\s*/, '');

  if (effectiveTitle.startsWith('Tillandsia')) {
    for (const parent of TILLANDSIA_PARENTS) {
      if (title === parent.title) return { genus: 'tillandsia', parentTitle: null };
      for (const prefix of parent.prefixes) {
        if (title.startsWith(prefix) && title !== parent.title) {
          return { genus: 'tillandsia', parentTitle: parent.title };
        }
      }
    }
    return { genus: 'tillandsia', parentTitle: null };
  }

  for (const [prefix, genus] of [
    ['Oxalis', 'oxalis'],
    ['Lepanthes', 'lepanthes'],
    ['Avonia', 'avonia'],
  ]) {
    if (effectiveTitle.startsWith(prefix)) return { genus, parentTitle: null };
  }

  return { genus: null, parentTitle: null };
}

/**
 * パンくずリストを返す（最後の要素が現在ページ、href: null）
 * @returns {Array<{ label: string, href: string|null }>}
 */
export function getBreadcrumbs(title, titleToId) {
  const { genus, parentTitle } = getCategory(title);
  const top = { label: 'トップ', href: '/' };

  if (!genus) return [];
  if (genus === 'about') return [top, { label: 'About', href: null }];
  if (genus === 'article') {
    return [top, { label: 'Article', href: '/article' }, { label: title, href: null }];
  }

  const labels = {
    tillandsia: 'Tillandsia',
    oxalis: 'Oxalis',
    lepanthes: 'Lepanthes',
    avonia: 'Avonia',
  };
  const genusItem = { label: labels[genus], href: `/genus/${genus}` };

  if (parentTitle) {
    const parentId = titleToId[parentTitle];
    return [
      top,
      genusItem,
      { label: parentTitle, href: parentId ? `/page/${parentId}` : null },
      { label: title, href: null },
    ];
  }

  return [top, genusItem, { label: title, href: null }];
}
