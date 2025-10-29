// ~/Sites/LexFlow/cloudflare/src/index.js
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });

      if (request.method === "GET") {
        return new Response(JSON.stringify({ ok: true, hint: "Use POST with JSON payload" }), {
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }

      if (request.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Use POST" }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }

      const { title, markdown, metadata } = await request.json();

      if (!title || !markdown || !metadata?.language) {
        console.error('Missing required fields:', { title: !!title, markdown: !!markdown, language: metadata?.language });
        return new Response(JSON.stringify({ ok: false, error: "Missing required fields: title, markdown, metadata.language" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }

      console.log('Processing request:', { title, jurisdiction: metadata.jurisdiction, language: metadata.language });

      const token = env.GITHUB_TOKEN;
      if (!token) throw new Error("Missing GITHUB_TOKEN in environment");

      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      const baseBranch = env.DEFAULT_BRANCH || "main";

      const fileSlug = metadata.file_slug || slugify(title);
      const lang = metadata.language || "en-US";
      
      // Parse jurisdiction properly (format: "US/Federal" or "BR/RS" etc)
      let country, level;
      if (metadata.jurisdiction && metadata.jurisdiction.includes('/')) {
        const parts = metadata.jurisdiction.split('/');
        country = parts[0].toLowerCase();
        level = parts[1].toLowerCase();
      } else {
        // Fallback: derive country from language
        const languageToCountry = {
          'pt-BR': 'br',
          'en-US': 'us', 
          'es-ES': 'es'
        };
        country = languageToCountry[lang] || 'us';
        level = 'federal';
      }
      
      const dir = `contents/${lang}/${country}/${level}`;
      const path = `${dir}/${fileSlug}.md`;
      
      console.log('Constructed path:', { path, dir, fileSlug, country, level, lang });

      // 1️⃣ Get base branch SHA
      const base = await ghGET(env, `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
      const baseSha = base.object.sha;

      // 2️⃣ Create new branch
      const branch = `lexflow/${fileSlug}-${Date.now().toString(36)}`;
      await ghPOST(env, `/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: baseSha
      });

      // 3️⃣ Check if file exists and add/update file
      const contentB64 = btoaUnicode(markdown);
      let fileSha = null;
      
      try {
        // Try to get existing file
        const existingFile = await ghGET(env, `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
        fileSha = existingFile.sha;
      } catch (error) {
        // File doesn't exist, that's fine
      }
      
      const filePayload = {
        message: fileSha ? `chore(lexflow): update ${fileSlug}` : `chore(lexflow): add ${fileSlug}`,
        content: contentB64,
        branch
      };
      
      if (fileSha) {
        filePayload.sha = fileSha;
      }
      
      await ghPUT(env, `/repos/${owner}/${repo}/contents/${path}`, filePayload);

      // 4️⃣ Create PR
      const pr = await ghPOST(env, `/repos/${owner}/${repo}/pulls`, {
        title: `[LexFlow] ${title}`,
        head: branch,
        base: baseBranch,
        body: `Automated submission via LexFlow Worker.\n\nPath: \`${path}\``
      });

      return new Response(JSON.stringify({ ok: true, url: pr.html_url, branch, path }), {
        headers: { "Content-Type": "application/json", ...CORS }
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }
  }
};

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\- ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function btoaUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function ghGET(env, path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "lexflow-worker"
    }
  });
  if (!res.ok) throw new Error(`GitHub GET ${path} -> ${res.status}`);
  return res.json();
}

async function ghPOST(env, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "lexflow-worker",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub POST ${path} -> ${res.status}`);
  return res.json();
}

async function ghPUT(env, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      "User-Agent": "lexflow-worker",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path} -> ${res.status}`);
  return res.json();
}