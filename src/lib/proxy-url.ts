// 纯函数：按优先级从环境变量挑代理 URL。优先级 HTTPS > HTTP > ALL。可被 node --test 直跑。
export function pickProxyUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return (
    env.HTTPS_PROXY ||
    env.https_proxy ||
    env.HTTP_PROXY ||
    env.http_proxy ||
    env.ALL_PROXY ||
    env.all_proxy ||
    null
  );
}

/** undici ProxyAgent 仅支持 http(s) 代理；socks 等交给全局兜底路径处理。 */
export function isHttpProxyUrl(url: string | null | undefined): boolean {
  return /^https?:\/\//i.test(url ?? "");
}
