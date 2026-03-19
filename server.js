const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // 🚀 Block images, fonts, and stylesheets (faster and lighter)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for the main body to render
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(1000); // extra delay for JS-heavy sites

    // 🚀 Handle cookie banners automatically
    try {
      const elements = await page.$$('*');
      for (const el of elements) {
        const text = await page.evaluate(e => e.innerText?.toLowerCase(), el);
        if (text && (text.includes('accept') || text.includes('agree') || text.includes('allow all'))) {
          try {
            await el.click();
            console.log('✅ Cookie banner clicked');
            break;
          } catch {}
        }
      }
    } catch (e) {
      console.log('No cookie banner found');
    }

    // 🚀 Extract page data
    const data = await page.evaluate(() => {
      return {
        title: document.title,
        html: document.documentElement.outerHTML,
        links: Array.from(document.querySelectorAll('a')).map(a => a.href),
        text: document.body.innerText
      };
    });

    await browser.close();
    res.json(data);

  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(3000, () => {
  console.log('Scraper service running on port 3000');
});