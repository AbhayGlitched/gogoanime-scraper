const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/scrape', async (req, res) => {
  const { url, endEpisodeNumber } = req.body;
  const baseurl = url.slice(0, url.lastIndexOf('-') + 1);
  let EpisodeUrlList = [];
  let DownloadEpisodeUrlList = [];
  let allEpisodeLinks = [];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Generate episode URLs
  for (let i = 1; i <= endEpisodeNumber; i++) {
    EpisodeUrlList.push(`${baseurl}${i}`);
  }

  // Scrape initial download links
  for (const episodeUrl of EpisodeUrlList) {
    try {
      const { data } = await axios.get(episodeUrl);
      const $ = cheerio.load(data);
      const link = $('li.dowloads a').first().attr('href');
      if (link) DownloadEpisodeUrlList.push(link);
      res.write(`data: ${JSON.stringify({ type: 'log', message: `Scraped initial link for episode ${episodeUrl}` })}\n\n`);
    } catch (error) {
      console.error(`Error scraping data from ${episodeUrl}:`, error);
      res.write(`data: ${JSON.stringify({ type: 'log', message: `Error scraping data from ${episodeUrl}: ${error.message}` })}\n\n`);
    }
  }

  // Scrape dynamic download links
  const browser = await puppeteer.launch({ headless: true });
  for (let i = 0; i < DownloadEpisodeUrlList.length; i++) {
    const episodeUrl = DownloadEpisodeUrlList[i];
    try {
      const page = await browser.newPage();
      await page.goto(episodeUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#content-download .mirror_link .dowload a', { timeout: 5000 });
      
      const downloadLinks = await page.$$eval('#content-download .mirror_link .dowload a', anchors => 
        anchors.map(anchor => ({
          resolution: anchor.textContent.trim(),
          link: anchor.href
        }))
      );

      allEpisodeLinks.push({
        episode: episodeUrl,
        downloadLinks: downloadLinks
      });

      await page.close();
      res.write(`data: ${JSON.stringify({ type: 'log', message: `Scraped dynamic links for episode ${i + 1}` })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'progress', value: ((i + 1) / DownloadEpisodeUrlList.length) * 100 })}\n\n`);
    } catch (error) {
      console.error(`Error scraping dynamic links from ${episodeUrl}:`, error);
      res.write(`data: ${JSON.stringify({ type: 'log', message: `Error scraping dynamic links from ${episodeUrl}: ${error.message}` })}\n\n`);
    }
  }
  await browser.close();

  res.write(`data: ${JSON.stringify({ type: 'complete', data: allEpisodeLinks })}\n\n`);
  res.end();
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});