// GitHub：owner/repo → releases.atom（信号密度高）。已是 URL 则原样返回。
export function buildGithubUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const repo = s
    .replace(/^github\.com\//i, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return `https://github.com/${repo}/releases.atom`;
}
