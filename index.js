const express = require('express');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom'); // 引入 jsdom
const bodyParser = require('body-parser'); // 用于解析请求体
const TurndownService = require('@joplin/turndown');
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm');
const { Readability, isProbablyReaderable } = require('@mozilla/readability');
const axios = require('axios');


const app = express();
const port = 3000;
const poolSize = 10;  // 预先打开的页面数量

app.use(bodyParser.json());

// 中间件：打印请求的详细信息
app.use((req, res, next) => {
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);
  next(); // 调用 next() 以继续处理请求
});

let browser; // 全局变量，用于存储浏览器实例
const pagePool = []; // 页面池

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true, // 设置为无头模式
      args: [
        '--no-sandbox', // 禁用沙盒
        '--disable-setuid-sandbox', // 禁用 setuid 沙盒
        '--disable-gpu', // 在一些环境下，可以加速渲染
        '--window-size=1920,1080', // 设置窗口大小
        '--disable-dev-shm-usage', // 解决共享内存不足的问题
        '--disable-web-security', // 禁用网络安全
        '--disable-extensions', // 禁用扩展
        '--disable-background-timer-throttling', // 禁用后台定时器节流
        '--disable-renderer-backgrounding', // 禁用渲染器的后台处理
        '--disable-infobars', // 禁用信息栏
        '--no-first-run', // 跳过第一次运行的提示
      ]
    });

    await initializePagePool();
  }
  return browser;
}

async function initializePagePool() {
  for (let i = 0; i < poolSize; i++) {
    const page = await createConfiguredPage();
    pagePool.push(page);
  }
}

async function createConfiguredPage() {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
      request.abort();
    } else {
      request.continue();
    }
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  return page;
}

// 从页面池中借用一个页面
async function borrowPage() {
  if (pagePool.length === 0) {
    console.log('No available pages in pool');
    return null;
  }
  return pagePool.pop();
}

// 归还页面到池中
async function returnPage(page) {
  pagePool.push(page);
}

async function openNewTab(url) {
  const page = await borrowPage(); // 从池中借用页面
  if (!page) return null;

  try {
    const startTime = Date.now(); // 记录开始时间
    await page.goto(url, { waitUntil: 'load', timeout: 30000 }); // 访问指定的 URL
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    const endTime = Date.now(); // 记录结束时间
    const duration = endTime - startTime; // 计算耗时
    console.log(`Page loaded in ${duration} ms`); // 输出耗时
    return html;
  } catch (error) {
    console.error("Error opening new page:", error);
    return null;
  } finally {
    await returnPage(page); // 归还页面
  }
}

function filterHtmlContent(dom) {
  const { document } = dom.window;
  const { body } = document;
  const filters = ['script', 'style', 'link', 'footer'];
  const meaningfulTags = ['pre', 'code', 'iframe', 'template', 'object', 'svg', 'form', 'canvas'];

  Array.from(body.querySelectorAll(filters.join(', ')))
    .forEach(element => {
      if (!element.closest(meaningfulTags.join(','))) {
        element.remove();
      }
    });

  body.innerHTML = body.innerHTML.replace(/<img [^>]*src=["']data:image\/[^"']*["'][^>]*>/gi, '');
  return dom;
}

function _readability(dom) {
  const { document } = dom.window;
  if (isProbablyReaderable(document)) {
    console.log("自动识别正文区域");
    return new Readability(document).parse().content;
  }
  return document.body.innerHTML;
}

app.post('/', async (req, res) => {
  const { url } = req.body;
  try {
    const html = await openNewTab(url);
    if (!html) throw new Error("Failed to fetch page content");
    console.log("HTML content length:", html.length);

    const dom = new JSDOM(html);
    console.log("JSDOM created successfully");
    console.log("JSDOM window:", !!dom.window);
    console.log("JSDOM document:", !!dom.window.document);
    console.log("JSDOM body:", !!dom.window.document.body);

    const filteredDom = filterHtmlContent(dom);
    const article = _readability(filteredDom);

    const turndownService = new TurndownService().use(turndownPluginGfm.gfm);
    const markdown = turndownService.turndown(article);

    res.send(markdown);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send(error.message);
  }
});

app.get('/getsub', async (req, res) => {
  try {
    // 从指定的 URL 获取内容
    const response = await axios.get('https://dl.jisusub.cc/api/v1/client/subscribe?token=d42fdfbf3cbd13f526e68f1a75681f8e', {
      headers: {
        'User-Agent': 'SFA/1.9.6 (394; sing-box 1.9.6)'
      }
    });
    const data = response.data;

    // 假设内容是 JSON 结构
    if (data && data['route']['rule_set'] && Array.isArray(data['route']['rule_set'])) {

      // 修改 rule_set 子元素中的 url 参数
      data['route']['rule_set'].forEach(rs => {
        if (rs.tag == 'geoip-cn') {
          rs.url = 'https://data.devtool.uk/geoip-cn.db';
        }
        if (rs.tag == 'geosite-cn') {
          rs.url = 'https://data.devtool.uk/geosite-cn.db';
        }
      });

      res.json(data);
    } else {
      res.status(400).send('Invalid data structure');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

getBrowser().then(() => {
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Error starting browser:', err);
  process.exit(1);
});
