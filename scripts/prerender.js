import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, cpSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function generateStaticHtml() {
  const clientDir = join(root, "dist", "client");
  const assetsDir = join(clientDir, "assets");

  let entryScript = null;
  let entryCss = null;
  
  if (existsSync(assetsDir)) {
    // Find all compiled JS files, ignoring node_modules
    const jsFiles = readdirSync(assetsDir).filter(
      (f) => f.endsWith(".js") && !f.includes("node_modules")
    );
    
    // Grab the largest JS bundle as the main client entry
    if (jsFiles.length > 0) {
      const largestJs = jsFiles.sort((a, b) => {
        const sa = readFileSync(join(assetsDir, a)).length;
        const sb = readFileSync(join(assetsDir, b)).length;
        return sb - sa;
      })[0];
      
      // Use relative paths to prevent Capacitor routing conflicts
      entryScript = `./assets/${largestJs}`;
    }

    // Find all compiled CSS files
    const cssFiles = readdirSync(assetsDir).filter((f) => f.endsWith(".css"));
    if (cssFiles.length > 0) {
        const largestCss = cssFiles.sort((a, b) => {
            return readFileSync(join(assetsDir, b)).length - readFileSync(join(assetsDir, a)).length;
        })[0];
        entryCss = `./assets/${largestCss}`;
    }
  }

  const templatePath = join(root, "index.html");
  let html = readFileSync(templatePath, "utf-8");

  // 1. Strip out any existing development scripts securely
  html = html.replace(/<script type="module" src="[^"]+"><\/script>/g, "");

  // 2. Inject the compiled client bundle right before the closing </body> tag
  if (entryScript) {
    html = html.replace("</body>", `  <script type="module" src="${entryScript}"></script>\n  </body>`);
  }

  // 3. Inject the CSS right before the closing </head> tag
  if (entryCss && !html.includes(entryCss)) {
    html = html.replace("</head>", `  <link rel="stylesheet" href="${entryCss}">\n  </head>`);
  }

  const outputPath = join(clientDir, "index.html");
  writeFileSync(outputPath, html, "utf-8");
  console.log(`Generated ${html.length} bytes to ${outputPath}`);

  // Copy to .output/public for Capacitor
  const capacitorDir = join(root, ".output", "public");
  mkdirSync(join(root, ".output"), { recursive: true });
  cpSync(clientDir, capacitorDir, { recursive: true });
  console.log(`Copied client assets to ${capacitorDir}`);
}

generateStaticHtml();
