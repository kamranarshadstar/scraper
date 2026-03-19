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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Block images, fonts, stylesheets to save CPU
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) req.abort();
      else req.continue();
    });

    // Navigate to page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Accept cookie banners automatically
    try {
      const buttons = await page.$$('button, a');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.innerText?.toLowerCase(), btn);
        if (text && (text.includes('accept') || text.includes('agree') || text.includes('allow all'))) {
          await btn.click();
          await new Promise(r => setTimeout(r, 1000)); // replaces waitForTimeout
          break;
        }
      }
    } catch {}

    // Wait a little for JS content
    await new Promise(r => setTimeout(r, 2000)); // replaces waitForTimeout

    // Extract structured data
    const data = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      })).filter(l => l.href);

      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
        tag: h.tagName,
        text: h.innerText.trim()
      }));

      const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t);

      const lists = Array.from(document.querySelectorAll('ul,ol')).map(list => ({
        tag: list.tagName,
        items: Array.from(list.querySelectorAll('li')).map(li => li.innerText.trim())
      }));

      return { links, headings, paragraphs, lists, html: document.documentElement.outerHTML };
    });

    data.title = await page.title();

    await browser.close();
    res.json(data);

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Scraper running on port 3000');
});
