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

    // Block images/fonts/stylesheets to reduce CPU/memory
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(type)) req.abort();
      else req.continue();
    });

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Set viewport
    await page.setViewport({ width: 1080, height: 1024 });

    // Wait a short time to allow JS to load
    await new Promise(r => setTimeout(r, 2000)); // replaces waitForTimeout

    // Example: grab page title and first link text
    const title = await page.title();
    const firstLink = await page.$('a');
    let linkText = '';
    if (firstLink) {
      linkText = await page.evaluate(el => el.textContent, firstLink);
    }

    await browser.close();

    res.json({ title, firstLinkText: linkText });
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Scraper running on port 3000'));
