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

    // Block images, fonts, CSS to save CPU/memory
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font'].includes(type)) req.abort();
      else req.continue();
    });

    // Go to the page
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.setViewport({ width: 1080, height: 1024 });

    // Example: search input if it exists
    // Replace with page-specific selector
    const searchSelector = 'input[name="q"], input[type="search"]';
    const searchBox = await page.$(searchSelector);
    if (searchBox) {
      await searchBox.type('automate beyond recorder');
      await searchBox.press('Enter');
      await page.waitForTimeout(2000); // wait for results
    }

    // Example: get the first link text
    const firstLink = await page.$('a'); // customize selector
    let linkText = '';
    if (firstLink) {
      linkText = await page.evaluate(el => el.textContent, firstLink);
    }

    // Send response
    res.json({
      title: await page.title(),
      firstLinkText: linkText
    });

    await browser.close();
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Scraper server running on port 3000');
});
