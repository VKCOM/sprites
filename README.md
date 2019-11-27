# @vkontakte/sprites

![Module version badge](https://img.shields.io/npm/v/@vkontakte/sprites.svg)
![License badge](https://img.shields.io/github/license/VKCOM/sprites.svg)
![Minimum Node.JS version badge](https://img.shields.io/node/v/@vkontakte/sprites.svg)

Module for generate SVG sprites and PNG fallback that used in m.vk.com

## Requirements

Inkscape (>= 0.91)

Node.JS (>= 8)

## Install

`npm install @vkontakte/sprites` or `yarn add @vkontakte/sprites`

## Demo

See [demo/index.js](demo/index.js)

## Generating

To generate Sprites you just need to run

`generate(path, output = {}, converter, options)`

- `path` is place on your filesystem where module loads SVG icons
- `converter` see [PNG Fallback](#png-fallback) section

## PNG Fallback

In this time there is single PNG converter `Inkscape`, but you can PR your if you need. It is simple, you just need to extend [BaseConverter](src/convert/BaseConverter.js)

To create PNG converter you need to import it

`const InkscapeConverter = require("@vkontakte/sprites/src/convert/InkscapeConverter")`

Then create new instance of Converter

`const converter = new InkscapeConverter([1, 2], pngPath, "/opt/local/bin/inkscape"),`

And use as [param for generating sprites](#generating)
