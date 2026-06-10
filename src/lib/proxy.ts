// 让 Node 内置 fetch（undici）走本地代理：读 HTTPS_PROXY/HTTP_PROXY/ALL_PROXY，
// 用 undici ProxyAgent + setGlobalDispatcher。仅支持 http(s) 代理；socks 会被忽略并提示。
import { Agent, ProxyAgent, setGlobalDispatcher, type Dispatcher } from "undici";
import { pickProxyUrl } from "./proxy-url";

let configured = false;
let activeProxy: string | null = null;

let directAgent: Agent | null = null;
const proxyAgents = new Map<string, ProxyAgent>();

/** 直连 dispatcher（不走任何代理）。国内刷新（如 Bilibili）按请求覆盖全局代理用。 */
export function directDispatcher(): Dispatcher {
  if (!directAgent) directAgent = new Agent();
  return directAgent;
}

/** 指定代理 dispatcher。国外刷新按请求显式走代理用。 */
export function proxyDispatcher(url: string): Dispatcher {
  let a = proxyAgents.get(url);
  if (!a) {
    a = new ProxyAgent(url);
    proxyAgents.set(url, a);
  }
  return a;
}

/** 进程内只配置一次。返回生效的代理 URL（无则 null）。不会打印任何密钥。 */
export function setupProxy(): string | null {
  if (configured) return activeProxy;
  configured = true;

  const url = pickProxyUrl();
  if (!url) return null;

  if (!/^https?:\/\//i.test(url)) {
    console.warn(
      `[proxy] 检测到非 http(s) 代理（${url}），undici 仅支持 http(s)，已忽略。请设置 HTTPS_PROXY=http://… 让 fetch 走代理。`,
    );
    return null;
  }

  setGlobalDispatcher(new ProxyAgent(url));
  activeProxy = url;
  console.log(`[proxy] fetch 已走代理：${url}`);
  return url;
}
