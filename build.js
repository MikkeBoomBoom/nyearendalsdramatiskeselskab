const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

/**
 * Liten helper: enkel markdown -> HTML for avsnitt og linjeskift
 */
function mdToHtml(text) {
  if (!text) return "";
  const paragraphs = text.trim().split(/\n\s*\n/);
  return paragraphs
    .map(p => {
      const lines = p.split("\n").join("<br>");
      return `<p>${lines}</p>`;
    })
    .join("\n");
}

/**
 * Hent Instagram-poster via Instagram Graph API.
 * For at dette skal fungere må du:
 *  - Opprette en Instagram-app
 *  - Skaffe en lang-lived access token
 *  - Legge token og user id som miljøvariabler i Netlify:
 *      INSTAGRAM_TOKEN
 *      INSTAGRAM_USER_ID
 *
 * Hvis variabler mangler, returnerer funksjonen tom streng og bygger
 * bare siden uten Instagram-grid.
 */
async function fetchInstagramHtml() {
  const token = process.env.INSTAGRAM_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    console.log("Ingen Instagram-token satt, hopper over IG-seksjon.");
    return "";
  }

  const url = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_url,permalink,media_type,timestamp&access_token=${token}&limit=6`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Klarte ikke å hente Instagram-data:", res.status);
      return "";
    }
    const data = await res.json();
    const items = (data.data || []).filter(
      item => item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM"
    );

    const html = items
      .map(
        item => `
      <a class="ig-card" href="${item.permalink}" target="_blank" rel="noopener">
        <div class="ig-image" style="background-image:url('${item.media_url}')"></div>
      </a>`
      )
      .join("\n");

    return html;
  } catch (err) {
    console.error("Feil ved henting av Instagram:", err);
    return "";
  }
}

async function build() {
  const contentPath = path.join(__dirname, "content", "forside.yml");
  const templatePath = path.join(__dirname, "src", "index.template.html");
  const outDir = path.join(__dirname, "dist");
  const outPath = path.join(outDir, "index.html");

  const contentRaw = fs.readFileSync(contentPath, "utf8");
  const content = yaml.load(contentRaw);

  const template = fs.readFileSync(templatePath, "utf8");

  const instagramHtml = await fetchInstagramHtml();

  let html = template
    .replace(/%%HERO_TITLE%%/g, content.hero_title || "")
    .replace(/%%HERO_INTRO%%/g, content.hero_intro || "")
    .replace(/%%TICKET_URL%%/g, content.ticket_url || "#")
    .replace(/%%ABOUT_TITLE%%/g, content.about_title || "")
    .replace(/%%ABOUT_BODY_HTML%%/g, mdToHtml(content.about_body || ""))
    .replace(/%%GUNNAR_TITLE%%/g, content.gunnar_title || "")
    .replace(/%%GUNNAR_ROLE_LINE%%/g, content.gunnar_role_line || "")
    .replace(/%%GUNNAR_IMAGE%%/g, content.gunnar_image || "")
    .replace(/%%GUNNAR_QUOTE%%/g, content.gunnar_quote || "")
    .replace(/%%GUNNAR_BODY_HTML%%/g, mdToHtml(content.gunnar_body || ""))
    .replace(/%%INSTAGRAM_ITEMS%%/g, instagramHtml);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  fs.writeFileSync(outPath, html, "utf8");
  console.log("Bygget ferdig dist/index.html");
}

// Node 18+ har global fetch
if (typeof fetch === "undefined") {
  console.error(
    "fetch er ikke tilgjengelig i denne Node-versjonen. Sett Node 18+ i Netlify, eller fjern Instagram-koden."
  );
  process.exit(1);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});

