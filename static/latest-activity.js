// Read bounded history pages until the newest requested records are found.
export async function latestActivity(readPage, limit, { isCurrent = () => true, onPage = () => {} } = {}) {
  const items = [], cursors = new Set();
  let cursor = null;
  do {
    if (!isCurrent()) return null;
    const page = await readPage(cursor, limit - items.length);
    if (!isCurrent()) return null;
    items.push(...page.items.slice(0, limit - items.length));
    cursor = page.nextCursor || null;
    if (cursor && cursors.has(cursor)) throw new Error("Activity pagination did not advance. Please refresh to retry.");
    if (cursor) cursors.add(cursor);
    onPage({ items: [...items], nextCursor: cursor });
  } while (items.length < limit && cursor);
  return { items, nextCursor: cursor };
}
