// 纯树逻辑：构建任意深度的树、求子孙集合、求完整路径、扁平化 folder（带路径/深度）。
// 无外部依赖，可被 node --test 直跑。用于左侧导航与父级选择器。

export interface TreeRow {
  id: string;
  name: string;
  nodeKind: string; // folder | room
  parentId: string | null;
  sortOrder: number;
}

export interface TreeNode<T extends TreeRow = TreeRow> {
  row: T;
  children: TreeNode<T>[];
}

function sortSiblings<T extends TreeRow>(rows: T[]): T[] {
  // folder 在前，再按 sortOrder，再按 name
  return [...rows].sort((a, b) => {
    const af = a.nodeKind === "folder";
    const bf = b.nodeKind === "folder";
    if (af !== bf) return af ? -1 : 1;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
}

export function buildTree<T extends TreeRow>(rows: T[]): TreeNode<T>[] {
  const childrenOf = (pid: string | null) =>
    sortSiblings(rows.filter((r) => r.parentId === pid));
  const build = (pid: string | null): TreeNode<T>[] =>
    childrenOf(pid).map((row) => ({ row, children: build(row.id) }));
  return build(null);
}

/** 某节点的所有子孙 id（不含自身）。 */
export function descendantIds(rows: TreeRow[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) => {
    for (const c of rows.filter((r) => r.parentId === pid)) {
      if (!out.has(c.id)) {
        out.add(c.id);
        walk(c.id);
      }
    }
  };
  walk(id);
  return out;
}

/** 从根到该节点的名称路径，如 ["乃木坂46","5期生"]。防环。 */
export function nodePath(rows: TreeRow[], id: string): string[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const path: string[] = [];
  const seen = new Set<string>();
  let cur: string | null = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const r = byId.get(cur);
    if (!r) break;
    path.unshift(r.name);
    cur = r.parentId;
  }
  return path;
}

export interface FlatFolder {
  id: string;
  name: string;
  path: string[]; // 完整路径名
  depth: number;
}

/**
 * 按树序扁平化所有 folder，带完整路径与深度。
 * excludeSubtreeOf：排除某节点自身 + 其全部子孙（父级选择器防止自指/成环）。
 */
export function flattenFolders(
  rows: TreeRow[],
  excludeSubtreeOf?: string,
): FlatFolder[] {
  const exclude = new Set<string>();
  if (excludeSubtreeOf) {
    exclude.add(excludeSubtreeOf);
    for (const d of descendantIds(rows, excludeSubtreeOf)) exclude.add(d);
  }
  const out: FlatFolder[] = [];
  const walk = (nodes: TreeNode[], depth: number, prefix: string[]) => {
    for (const n of nodes) {
      const path = [...prefix, n.row.name];
      if (n.row.nodeKind === "folder" && !exclude.has(n.row.id)) {
        out.push({ id: n.row.id, name: n.row.name, path, depth });
      }
      walk(n.children, depth + 1, path);
    }
  };
  walk(buildTree(rows), 0, []);
  return out;
}
