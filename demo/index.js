const path = require("path");
const generate = require("../src");

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
    {
      need2x: true,
      cssPrefix: "vk"
    }
  );

  console.timeEnd("Generating sprites");
})();
