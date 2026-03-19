import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Block images, fonts, stylesheets for speed
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(type)) req.abort();
      else req.continue();
    });

    // Navigate to the page
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait a few seconds for JS-heavy content
    await new Promise(r => setTimeout(r, 2000));

    // Scrape all links
    const links = await page.$$eval('a', nodes =>
      nodes.map(n => ({ text: n.innerText.trim(), href: n.href }))
    );

    // Scrape all headings (h1–h6)
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', nodes =>
      nodes.map(n => ({ tag: n.tagName, text: n.innerText.trim() }))
    );

    // Scrape all paragraphs
    const paragraphs = await page.$$eval('p', nodes =>
      nodes.map(n => n.innerText.trim()).filter(t => t)
    );

    // Optional: get full page HTML
    const html = await page.content();

    await browser.close();

    res.json({
      url,
      title: await page.title(),
      links,
      headings,
      paragraphs,
      html
    });
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Scraper running on port 3000'));
