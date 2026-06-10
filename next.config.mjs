/** @type {import('next').NextConfig} */
const nextConfig = {
  // 缩略图来自任意平台主机，使用普通 <img>，无需 next/image 域名白名单。
  reactStrictMode: true,
  // v0 不引入 eslint 依赖；构建时跳过 lint（类型检查仍然开启）。
  eslint: { ignoreDuringBuilds: true },
  // playwright-core 只在打开登录窗口 / 检查登录态时按需 import，不打进 bundle。
  experimental: { serverComponentsExternalPackages: ["playwright-core"] },
};

export default nextConfig;
