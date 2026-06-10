// arXiv：构造 Atom 查询 URL（零 key）。query 形如 cat:cs.AI、all:world models、au:LeCun。
// start 用于分页（全部/范围刷新时向更早翻页）。
export function buildArxivUrl(query: string, maxResults = 50, start = 0): string {
  // arXiv 用 + 作为空格分隔；保留 : . 等查询语法字符。
  const q = query.trim().replace(/\s+/g, "+");
  return `http://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${maxResults}`;
}
