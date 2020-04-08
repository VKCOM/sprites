const path = require("path");

const generate = require("../src");
const InkscapeConverter = require("../src/convert/InkscapeConverter");

(async () => {
  console.time("Generating sprites");

  const input = path.resolve("./input");

  const pngPath = 'output/png/';
  const svgPath = 'output/svg/';
  const cssPath = 'output/css/';
  const examplePath = path.resolve("./output/example");

  await generate(
    input,
    {
      pngPath,
      svgPath,
      cssPath,
      examplePath
    },
    new InkscapeConverter([1, 2], pngPath, "/Applications/Inkscape.app/Contents/MacOS/Inkscape"),
    {
      css: {
        stylesheetPrefix: "sprite-"
      },
      svg: {
        margin: 8,
        dest: "/images/mobile/icons/svg/"
      },
      png: {
        scalePrefix: "vk_",
        class: "png",
        dest: "/images/mobile/icons/svg"
      },
      themes: {
        'light': {
          isDefault: true,
          variables: {
            '--red': '#f00',
            '--green': '#0f0',
          },
        },
        'dark': {
          variables: {
            '--red': '#888',
            '--green': '#ccc',
          },
        },
      },
    }
  );

  console.timeEnd("Generating sprites");
})();
