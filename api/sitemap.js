const { createClient } = require('@supabase/supabase-js');

function escapeXml(unsafe) {
  return (unsafe || '').toString().replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default:  return c;
    }
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'theprivatianfamily.vercel.app';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${host}`;

  let articles = [];
  let sections = [];

  try {
    const { data: artData } = await sb
      .from('articles')
      .select('slug, updated_at, published_at, title, hero_img_url')
      .eq('status', 'published')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('published_at', { ascending: false });
    if (artData) articles = artData;
  } catch(e) {}

  try {
    const { data: secData } = await sb
      .from('sections')
      .select('slug, updated_at, created_at')
      .eq('is_active', true)
      .eq('is_deleted', false);
    if (secData) sections = secData.filter(s => s.slug && !s.slug.startsWith('__'));
  } catch(e) {}

  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Events -->
  <url>
    <loc>${baseUrl}/events</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  // Sections
  sections.forEach(s => {
    if (s.slug) {
      xml += `  <url>
    <loc>${baseUrl}/section/${escapeXml(s.slug)}</loc>
    <lastmod>${s.updated_at || s.created_at || now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    }
  });

  // Articles
  articles.forEach(a => {
    if (a.slug) {
      const artUrl = `${baseUrl}/article/${escapeXml(a.slug)}`;
      const artDate = a.updated_at || a.published_at || now;
      xml += `  <url>
    <loc>${artUrl}</loc>
    <lastmod>${artDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>${a.hero_img_url ? `
    <image:image>
      <image:loc>${escapeXml(a.hero_img_url)}</image:loc>
      <image:title>${escapeXml(a.title)}</image:title>
    </image:image>` : ''}
  </url>\n`;
    }
  });

  xml += `</urlset>`;

  return res.status(200).send(xml);
};
