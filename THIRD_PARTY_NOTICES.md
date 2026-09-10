# Third-party notices

Aakd's application license does not replace the licenses of bundled
third-party components. Package dependencies retain their own distributed
license files.

## English OCR trained data

The bundled file `apps/web/eng.traineddata` is the decompressed English
`4.0.0_best_int` model distributed in `@tesseract.js-data/eng@1.0.0`.
Aakd has not modified its decompressed bytes.

- Upstream artifact: [naptha/tessdata at b86746569320a6103cea84cc2b8d9ee74f0f45d3](https://raw.githubusercontent.com/naptha/tessdata/b86746569320a6103cea84cc2b8d9ee74f0f45d3/4.0.0_best_int/eng.traineddata.gz).
- Compressed size: 2,952,873 bytes. SHA-256: `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`.
- Bundled size: 5,199,098 bytes. SHA-256: `5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747`.
- The integerized model derives from [tesseract-ocr/tessdata_best at e9f15884bc503cf905c8a1dbbc9cb14458152628](https://github.com/tesseract-ocr/tessdata_best/tree/e9f15884bc503cf905c8a1dbbc9cb14458152628). That project's README licenses its data under Apache-2.0.
- The complete supplied data license is retained in [third-party-licenses/tessdata-best-APACHE-2.0.txt](third-party-licenses/tessdata-best-APACHE-2.0.txt). No separate `NOTICE` file was present in that upstream revision.

The npm distribution metadata separately declares MIT, lists Balearica as
author, and lists Balearica and Jerome Wu as contributors. Its tarball does
not supply a separate MIT license or copyright-notice file. This records
the package metadata without replacing the upstream trained-data license
or inventing a copyright notice.

The worker image includes this notice and the supplied data license under
`/app/THIRD_PARTY_NOTICES.md` and `/app/third-party-licenses/`.
