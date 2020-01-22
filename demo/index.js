const path = require("path");

const generate = require("../src");
const InkscapeConverter = require("../src/convert/InkscapeConverter");

(async () => {
  console.time("Generating sprites");

  const input = path.resolve("./input");

  const pngPath = path.resolve("./output/png");
  const svgPath = path.resolve("./output/svg");
  const cssPath = path.resolve("./output/css");

  await generate(
    input,
    {
      pngPath,
      svgPath,
      cssPath
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
      }
    }
  );

  console.timeEnd("Generating sprites");
})();
