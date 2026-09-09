# Penpa+ distribution

This directory contains Penpa+ 3.2.4 from [swaroopg92/penpa-edit](https://github.com/swaroopg92/penpa-edit), commit [`34e3fe97804e518288870b70d919e7e76ee18b4d`](https://github.com/swaroopg92/penpa-edit/tree/34e3fe97804e518288870b70d919e7e76ee18b4d/docs).

The original Penpa+ code is distributed under the [MIT License](LICENSE): copyright 2019 Opt-Pan and 2020 Swaroop Guggilam. Original source headers, library files, images, fonts, and bundled license files are retained.

## Changes in this copy

- Removed the two Google Tag Manager blocks from `index.html` and disabled `Identity.googleTag` in `identity.js`.
- Updated social metadata to the project-hosted address.
- Loaded `../penpa-adapter.js` after the Penpa classes. This separate compatibility adapter adds the converter's clue-artwork layer without changing Penpa's visible controls or wording.
- Made `import_url` in `js/general.js` accept the URL fragment or query independently of the hosting path.
- Changed the local/file sharing fallback in `js/class_p.js` to the project-hosted Penpa address so converted artwork continues to use its compatible viewer.

## Bundled dependencies

The following license files accompany the original library notices. Files fetched from the dependencies' official repositories are included without alteration.

| Component | License and source |
| --- | --- |
| localForage 1.10.0 | [Apache 2.0](licenses/localforage-LICENSE.txt), [upstream](https://github.com/localForage/localForage/blob/1.10.0/LICENSE) |
| DOMPurify 3.0.6 | [Apache 2.0 / Mozilla Public License 2.0](licenses/DOMPurify-LICENSE.txt), [upstream](https://github.com/cure53/DOMPurify/blob/3.0.6/LICENSE) |
| gif.js 0.2.0 and GIF worker | [MIT](licenses/gif-js-LICENSE.txt), [upstream](https://github.com/jnordberg/gif.js/blob/master/LICENSE) |
| jQuery 3.7.0 | [MIT](licenses/jquery-LICENSE.txt), [upstream](https://github.com/jquery/jquery/blob/3.7.0/LICENSE.txt) |
| SweetAlert2 11.14.4 | [MIT](licenses/sweetalert2-LICENSE.txt), [upstream](https://github.com/sweetalert2/sweetalert2/blob/v11.14.4/LICENSE) |
| js-md5 0.7.3 | [MIT](licenses/js-md5-LICENSE.txt), [upstream](https://github.com/emn178/js-md5/blob/v0.7.3/LICENSE.txt) |
| zlib.js | [MIT](licenses/zlib-js-LICENSE.txt), [upstream](https://github.com/imaya/zlib.js/blob/master/LICENSE) |
| canvas2svg | [MIT](licenses/canvas2svg-LICENSE.txt), [upstream](https://github.com/gliffy/canvas2svg/blob/master/LICENSE) |
| Text Encoding polyfill | [Unlicense / Apache 2.0](licenses/text-encoding-LICENSE.txt), [upstream](https://github.com/inexorabletash/text-encoding/blob/master/LICENSE.md) |
| EasyTimer 4.3.0 | [MIT](js/libs/easytimer_LICENSE.md) |
| Select2 4.1.0-rc.0 | [MIT](js/libs/select2_LICENSE.md) |
| Spectrum 1.8.1 | [MIT](js/libs/spectrum_LICENSE.md) |
| vanillaSelectBox | [MIT](js/libs/select_box_license.md) |
| Font Awesome 4.7.0 | Fonts: [SIL OFL 1.1](licenses/SIL-OFL-1.1.txt); CSS: MIT. Original attribution to Dave Gandy remains in `css/font-awesome.min.css` and the font metadata. [Official license](https://fontawesome.com/v4/license/) |

The Font Awesome Open Font License text is from [the official OFL site](https://openfontlicense.org/documents/OFL.txt). The Penpa canvas text extension retains its original copyright notice for Yuzo Matsuzawa.
