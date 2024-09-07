const express = require('express');
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom'); // 引入 jsdom
const app = express();
const bodyParser = require('body-parser'); // 用于解析请求体
app.use(bodyParser.json());
const port = 3000;
const TurndownService = require('@joplin/turndown')
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm')
const { Readability, isProbablyReaderable } = require('@mozilla/readability');

app.post('/',async (req, res) => {

  const args = req.body; // 获取请求体中的数据 
  const url = args.url 

  const browser = await chromium.launch({ headless: true }); // 打开浏览器并创建一个新标签
  const page = await browser.newPage();
try {
  await page.goto(url); // 访问指定的 URL
  await page.waitForLoadState('load');
  var html = await page.evaluate(() => document.documentElement.outerHTML);
  browser.close();

  // 使用 jsdom 解析 HTML
  const dom      = new JSDOM(html);
  const document = dom.window.document
  const body     = dom.window.document.body

  var article = ""

  if (isProbablyReaderable(document)) {

    let reader = new Readability(document).parse();
    article = reader.content
    console.log("read")
  }else{

    // 定义要过滤的标签
    const filters = ['javascript', 'script', 'style', 'link'];

    // 过滤掉直接子标签
    const directTags = Array.from(body.children).filter(child =>
      filters.includes(child.tagName.toLowerCase())
    );

    // 移除匹配的标签
    directTags.forEach(tag => tag.remove());

    // 获取处理后的 body 内容
    article = body.innerHTML;
    console.log("parse")
  }
  
  //HTML -> MarkDown

  var gfm = turndownPluginGfm.gfm
  var turndownService = new TurndownService()
  turndownService.use(gfm)

  var markdown = turndownService.turndown(article)

  res.send(markdown);
} catch (error) {
  browser.close()
  console.error('Error:', error); // 打印错误
  res.status(500).send(error.message)
}

});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
