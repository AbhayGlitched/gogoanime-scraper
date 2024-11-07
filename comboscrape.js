const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const fs = require('fs');

// URL Configuration
const eitherurl = 'https://www16.gogoanimes.fi/shin-tennis-no-oujisama-u-17-world-cup-semifinal-episode-6';
const endEpisodeNumber = 5;

// Create a base URL from the given URL, stopping just before the episode number part
const baseurl = eitherurl.slice(0, eitherurl.lastIndexOf('-') + 1);

// Initialize an array to store episode URLs
let EpisodeUrlList = [];

// Generate episode URLs
async function generateEpisodeUrlList() {
    for (let i = 1; i <= endEpisodeNumber; i++) {
        const url = `${baseurl}${i}`;
        EpisodeUrlList.push(url);
    }
    return EpisodeUrlList;
}

// Scrape download link from a given episode URL using Axios
const scrapeLinks = async (url) => {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract the first download link
        const link = $('li.dowloads a').first().attr('href'); // Corrected class name to 'downloads'
        
        return link;
    } catch (error) {
        console.error(`Error scraping data from ${url}:`, error);
        return null;
    }
};

let DownloadEpisodeUrlList = [];

// Main function to scrape initial download links for all episodes using Axios
async function scrapeAllLinks() {
    await generateEpisodeUrlList(); // Populate EpisodeUrlList
    
    for (const url of EpisodeUrlList) {
        const link = await scrapeLinks(url);
        if (link) {
            DownloadEpisodeUrlList.push(link);
        }
    }
    
    return DownloadEpisodeUrlList;
}

// Puppeteer function to scrape dynamic download links
async function scrapeIntoJson(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Wait for the download links to be loaded dynamically
    await page.waitForSelector('#content-download .mirror_link .dowload a');
    
    // Scrape the download links (e.g., 360p, 720p, 1080p)
    const downloadLinks = await page.$$eval('#content-download .mirror_link .dowload a', anchors => {
        return anchors.map(anchor => ({
            resolution: anchor.textContent.trim(),
            link: anchor.href
        }));
    });
    
    await browser.close();
    
    return downloadLinks;
}

// Main function to scrape all episodes and generate a JSON object
async function scrapeAllEpisodes() {
    await scrapeAllLinks(); // Populate DownloadEpisodeUrlList
    
    let allEpisodeLinks = [];
    
    for (const episodeUrl of DownloadEpisodeUrlList) {
        console.log(`Scraping dynamic download links for: ${episodeUrl}`);
          
        const downloadLinks = await scrapeIntoJson(episodeUrl);
        allEpisodeLinks.push({
            episode: episodeUrl,
            downloadLinks: downloadLinks
        });
    }

    // Save the data into a JSON file
    fs.writeFileSync('downloadLinks.json', JSON.stringify(allEpisodeLinks, null, 2), 'utf-8');
    console.log('Download links saved to downloadLinks.json');
}

// Execute the main function
scrapeAllEpisodes();
