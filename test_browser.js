const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.goto('http://localhost:5175/analyse');
  
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'INFY');
  await page.click('button[type="submit"]');

  await new Promise(r => setTimeout(r, 6000));
  
  const content = await page.content();
  const fs = require('fs');
  fs.writeFileSync('page_dump.html', content);
  console.log("HTML DUMPED");
  
  await browser.close();
})();
