// 节点挪动的纯逻辑（可被 node --test 直跑）：环检测 + 同级新顺序计算。
// 配合 POST /api/rooms/[id]/move 与侧栏拖拽使用。

export interface MoveRow {
  id: string;
  parentId: string | null;
}

/** candidateParent 是否为 nodeId 自身或其后代（防止把分区拖进自己的子树形成环）。 */
export function wouldCreateCycle(
  rows: MoveRow[],
  nodeId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId == null) return false;
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  let cur: string | null | undefined = candidateParentId;
  const guard = new Set<string>();
  while (cur != null) {
    if (cur === nodeId) return true;
    if (guard.has(cur)) return false; // 数据已含环时不再扩散
    guard.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

/**
 * 计算目标父级下的同级新顺序：把 movingId 插到 afterId 之后（afterId=null → 末尾）。
 * siblings 为目标父级下现有排序（不含 movingId 也可含，先剔除）。返回完整有序 id 列表。
 */
export function planSiblingOrder(
  siblings: string[],
  movingId: string,
  afterId: string | null,
): string[] {
  const rest = siblings.filter((id) => id !== movingId);
  if (afterId == null || !rest.includes(afterId)) return [...rest, movingId];
  const out: string[] = [];
  for (const id of rest) {
    out.push(id);
    if (id === afterId) out.push(movingId);
  }
  return out;
}
