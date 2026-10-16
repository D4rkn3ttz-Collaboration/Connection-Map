import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentSecurityPolicy, supabaseOrigin } from "../src/lib/csp.ts";

const out = join(import.meta.dirname, "..", "out");
const supabase = JSON.parse(readFileSync(new URL("../data/supabase.json", import.meta.url), "utf8"));
const csp = contentSecurityPolicy(supabaseOrigin(supabase));

// Netlify와 Cloudflare Pages가 읽는 설정이다. GitHub Pages는 이 파일을 무시한다.
writeFileSync(join(out, "_headers"), [
  "/*",
  `  Content-Security-Policy: ${csp}; frame-ancestors 'none'`,
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: no-referrer",
  "  X-Frame-Options: DENY",
  "",
].join("\n"));

// GitHub Pages에서는 HTML 정책만 유효하다. Next가 head 뒤쪽에 놓은 CSP를
// 첫 외부 스크립트보다 앞으로 옮겨 초기 리소스에도 정책이 적용되게 한다.
for (const name of readdirSync(out).filter((file) => file.endsWith(".html"))) {
  const path = join(out, name);
  const html = readFileSync(path, "utf8");
  const cspMeta = html.match(/<meta http-equiv="Content-Security-Policy" content="[^"]*"\/>/);
  if (!cspMeta) throw new Error(`${name}: CSP meta not found`);
  const withoutCsp = html.replace(cspMeta[0], "");
  if (!withoutCsp.includes('<meta charSet="utf-8"/>')) {
    throw new Error(`${name}: charset meta not found`);
  }
  const earlyMeta = `${cspMeta[0]}<meta name="referrer" content="no-referrer"/>`;
  writeFileSync(path, withoutCsp.replace('<meta charSet="utf-8"/>', `<meta charSet="utf-8"/>${earlyMeta}`));
}
