const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));

  // Goto homepage first to set local storage
  await page.goto('http://localhost:5175');
  await page.evaluate(() => {
    localStorage.setItem('user', JSON.stringify({ token: 'mock' }));
  });

  await page.goto('http://localhost:5175/analyse');
  
  // wait for it to load
  await new Promise(r => setTimeout(r, 2000));
  
  await page.waitForSelector('input[type="text"]');
  await page.type('input[type="text"]', 'INFY');
  await page.keyboard.press('Enter');

  await new Promise(r => setTimeout(r, 6000));
  await browser.close();
})();
