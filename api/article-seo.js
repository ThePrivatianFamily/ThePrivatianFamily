/**
 * api/article-seo.js — Server-side SEO & OpenGraph renderer for articles
 * Serves complete pre-rendered meta tags & HTML to crawlers & users for instant link previews
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function escapeHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const slug = req.query.slug || '';
  const id   = req.query.id || '';

  const { verifySession } = require('./_lib/auth');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'theprivatianfamily.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  let article = null;

  try {
    let query = sb.from('articles').select('*').or('is_deleted.is.null,is_deleted.eq.false');
    if (slug) {
      query = query.eq('slug', slug).eq('status', 'published');
    } else if (id) {
      query = query.eq('id', id);
    }
    const { data } = await query.maybeSingle();
    if (data) {
      if (data.status === 'published' || verifySession(req)) {
        article = data;
      }
    }
  } catch (err) {}

  // Read the base article.html template
  let html = '';
  try {
    const templatePath = path.join(process.cwd(), 'article.html');
    if (fs.existsSync(templatePath)) {
      html = fs.readFileSync(templatePath, 'utf8');
    }
  } catch (e) {}

  if (!html) {
    // If template file read fails in serverless, fallback redirect to /article.html
    return res.redirect(302, `/article.html?slug=${encodeURIComponent(slug)}`);
  }

  if (!article) {
    return res.status(200).send(html);
  }

  const title = article.seo_title || article.title || 'Article';
  const fullTitle = `${title} — The Privatian Family`;
  const desc = article.meta_description || article.deck || 'The Privatian Family — Insights, Stories & Heritage.';
  const canonicalUrl = `${baseUrl}/article/${article.slug || ''}`;
  const imgUrl = article.hero_img_url || `${baseUrl}/img1.png`;
  const publishedTime = article.published_at || article.created_at || new Date().toISOString();
  const modifiedTime = article.updated_at || article.published_at || article.created_at || new Date().toISOString();
  const author = article.author || 'The Privatian Family';
  const section = article.section || 'General';

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl
    },
    "headline": article.title || title,
    "description": desc,
    "image": article.hero_img_url ? [article.hero_img_url] : [],
    "datePublished": publishedTime,
    "dateModified": modifiedTime,
    "author": [{
      "@type": "Person",
      "name": author
    }],
    "publisher": {
      "@type": "Organization",
      "name": "The Privatian Family",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.png`
      }
    },
    "articleSection": section
  });

  const metaTags = `
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="The Privatian Family" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(imgUrl)}" />
  <meta property="article:published_time" content="${escapeHtml(publishedTime)}" />
  <meta property="article:modified_time" content="${escapeHtml(modifiedTime)}" />
  <meta property="article:section" content="${escapeHtml(section)}" />
  <meta property="article:author" content="${escapeHtml(author)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(imgUrl)}" />

  <!-- Google Structured Data (JSON-LD) -->
  <script type="application/ld+json">
${schemaJson}
  </script>
`;

  // Replace default title & description in head
  html = html.replace(/<title>[^<]*<\/title>/i, '');
  html = html.replace(/<meta name="description"[^>]*>/i, '');
  html = html.replace(/<head>/i, `<head>\n${metaTags}`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
