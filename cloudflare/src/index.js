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
        return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }

      const token = env.GITHUB_TOKEN;
      if (!token) throw new Error("Missing GITHUB_TOKEN in environment");

      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      const baseBranch = env.DEFAULT_BRANCH || "main";

      const fileSlug = metadata.file_slug || slugify(title);
      const lang = metadata.language || "en-US";
      const country = "US";
      const dir = `${lang}/${country}/federal/constitution`;
      const path = `${dir}/${fileSlug}.md`;

      // 1️⃣ Get base branch SHA
      const base = await ghGET(env, `/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`);
      const baseSha = base.object.sha;

      // 2️⃣ Create new branch
      const branch = `lexflow/${fileSlug}-${Date.now().toString(36)}`;
      await ghPOST(env, `/repos/${owner}/${repo}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: baseSha
      });

      // 3️⃣ Add file
      const contentB64 = btoaUnicode(markdown);
      await ghPUT(env, `/repos/${owner}/${repo}/contents/${path}`, {
        message: `chore(lexflow): add ${fileSlug}`,
        content: contentB64,
        branch
      });

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