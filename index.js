const express = require('express');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom'); // 引入 jsdom
const app = express();
const bodyParser = require('body-parser'); // 用于解析请求体
app.use(bodyParser.json());
const port = 3000;
const TurndownService = require('@joplin/turndown')
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm')
const { Readability, isProbablyReaderable } = require('@mozilla/readability');


let browser; // 全局变量，用于存储浏览器实例
const pagePool = []; // 页面池
const poolSize = 5;  // 预先打开的页面数量

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

    // 预先创建页面并放入池中
    for (let i = 0; i < poolSize; i++) {
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
      pagePool.push(page);
    }
  }
  return browser;
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
  if(page===null){
    return null
  }
  try {
    const startTime = Date.now(); // 记录开始时间
    await page.goto(url, { waitUntil: 'load', timeout: 30000 }); // 访问指定的 URL
    //await page.waitForNetworkIdle();
    // page.on('console', msg => console.log('PAGE LOG:', msg.text()), url);
    var html = await page.evaluate(() => document.documentElement.outerHTML);
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


  var window = dom.window
  var document = dom.window.document
  var body = dom.window.document.body

  // 获取所有 display: none 的元素
  const hiddenElements = body.querySelectorAll('*');

  hiddenElements.forEach(element => {
    // 判断元素的计算样式是否为 display: none
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === 'none') {
      element.remove();
    }
  });



  // 定义要过滤的标签
  const filters = ['script', 'style', 'link', 'javascript'];

  // 过滤掉非有意义的标签
  const elements = Array.from(body.querySelectorAll(filters.join(', ')));

  elements.forEach(element => {
    let parent = element.parentElement;
    let isInMeaningfulBlock = false;

    // 检查所有父级标签，直到找到相关容器
    while (parent) {
      const tagName = parent.tagName.toLowerCase();

      if (
        tagName === 'pre' ||
        tagName === 'code' ||
        tagName === 'iframe' ||
        tagName === 'template' ||
        tagName === 'object' ||
        tagName === 'svg' ||
        tagName === 'form' ||
        tagName === 'canvas'
      ) {
        isInMeaningfulBlock = true;
        break;
      }
      parent = parent.parentElement;
    }

    // 如果不在有意义的块中，则移除该标签
    if (!isInMeaningfulBlock) {
      element.remove();
    }
  });

  return dom
}

function _readability(dom) {
  var document = dom.window.document
  //再次识别一次正文
  if (isProbablyReaderable(document)) {
    let reader = new Readability(document).parse();
    console.log("自动识别正文区域")
    article = reader.content
    return article
  } else {
    return dom.window.document.body.innerHTML
  }

}


app.post('/', async (req, res) => {

  const args = req.body; // 获取请求体中的数据 
  const url = args.url

  try {


    var html = await openNewTab(url)
    // 使用 jsdom 解析 HTML
    var dom = new JSDOM(html);

    dom = filterHtmlContent(dom)

    var article = _readability(dom)

    var gfm = turndownPluginGfm.gfm
    var turndownService = new TurndownService()
    turndownService.use(gfm)

    var markdown = turndownService.turndown(article)

    res.send(markdown);

  } catch (error) {
    console.error('Error:', error); // 打印错误
    res.status(500).send(error.message)
  }

});

getBrowser().then(() => {
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Error starting browser:', err);
});
