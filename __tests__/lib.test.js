const tmp = require('tmp');
const generate = require('../src/index');
const puppeteer = require('puppeteer');
const { promisify } = require('util');
const path = require('path');
const InkscapeConverter = require("../src/convert/InkscapeConverter");

const createTempDir = promisify(tmp.dir);
tmp.setGracefulCleanup();

it('renders correctly with base config', (async () => {
  const tempDir = await createTempDir();

  const input = path.resolve(__dirname, "./fixtures/render");

  const pngPath = path.resolve(tempDir, "png");
  const svgPath = path.resolve(tempDir, "svg");
  const cssPath = path.resolve(tempDir, "css");

  await generate(
    input,
    {
      pngPath,
      svgPath,
      cssPath
    },
    null,
    {
      css: {
        stylesheetPrefix: "sprite-"
      },
      svg: {
        dest: "/images/mobile/icons/svg/"
      },
      png: {
        scalePrefix: "vk_",
        class: "png",
        dest: "/images/mobile/icons/svg"
      }
    }
  );
  
  // const browser = await puppeteer.launch();

  // const page = await browser.newPage();
  // await page.goto('https://localhost:3000');
  // const image = await page.screenshot();

  // expect(image).toMatchImageSnapshot();
}));