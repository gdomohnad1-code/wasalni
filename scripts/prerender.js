import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, cpSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/**
 * Without the Nitro SSR server, no index.html is generated. We create a
 * static SPA shell that loads the built client bundle so Capacitor's
 * WebView has an HTML entry point.
 */
function generateStaticHtml() {
  const clientDir = join(root, "dist", "client");
  const assetsDir = join(clientDir, "assets");

  // Find the main entry JS bundle (TanStack Start names it index-*.js)
  let entryScript = null;
  let entryCss = null;
  if (existsSync(assetsDir)) {
    const jsFiles = readdirSync(assetsDir).filter(
      (f) => f.startsWith("index-") && f.endsWith(".js") && !f.includes("node_modules"),
    );
    // The main bundle is typically the largest index-*.js
    if (jsFiles.length > 0) {
      entryScript = `/assets/${jsFiles.sort((a, b) => {
        const sa = existsSync(join(assetsDir, a)) ? readFileSync(join(assetsDir, a)).length : 0;
        const sb = existsSync(join(assetsDir, b)) ? readFileSync(join(assetsDir, b)).length : 0;
        return sb - sa;
      })[0]}`;
    }

    const cssFiles = readdirSync(assetsDir).filter(
      (f) => f.startsWith("index-") && f.endsWith(".css"),
    );
    if (cssFiles.length > 0) entryCss = `/assets/${cssFiles[0]}`;
  }

  const templatePath = join(root, "index.html");
  let html = readFileSync(templatePath, "utf-8");

  // Replace the dev entry point with the built bundle
  if (entryScript) {
    html = html.replace(
      /<script type="module" src="\/src\/main\.tsx"><\/script>/,
      `<script type="module" src="${entryScript}"></script>`,
    );
  }

  // Inject CSS link if found
  if (entryCss && !html.includes(entryCss)) {
    html = html.replace(
      "</head>",
      `    <link rel="stylesheet" href="${entryCss}">\n  </head>`,
    );
  }

  const outputPath = join(clientDir, "index.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`Generated ${html.length} bytes to ${outputPath}`);

  // Also copy to .output/public for Capacitor (webDir)
  const capacitorDir = join(root, ".output", "public");
  mkdirSync(join(root, ".output"), { recursive: true });
  cpSync(clientDir, capacitorDir, { recursive: true });
  console.log(`Copied client assets to ${capacitorDir}`);
}

generateStaticHtml();
