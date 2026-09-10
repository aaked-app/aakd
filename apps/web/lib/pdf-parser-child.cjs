"use strict"

// This isolated Node child runs directly as CommonJS, outside the application bundler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse")

function pageRender(pageData) {
  return pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  }).then((textContent) => {
    let lastY
    let pageText = ""
    for (const item of textContent.items) {
      if (lastY !== undefined && lastY !== item.transform[5]) pageText += "\n"
      pageText += item.str
      lastY = item.transform[5]
    }
    return `${pageText}\f`
  })
}

function send(payload) {
  fs.writeFileSync(3, JSON.stringify(payload), "utf8")
}

const inputBytesArgument = process.argv.find((argument) => argument.startsWith("--input-bytes="))
const inputBytes = Number(inputBytesArgument?.slice("--input-bytes=".length))
if (!Number.isSafeInteger(inputBytes) || inputBytes < 0 || inputBytes > 50 * 1024 * 1024) {
  process.exit(2)
}

const input = new Uint8Array(inputBytes)
let inputOffset = 0
let invalidInput = false
process.stdin.on("data", (chunk) => {
  if (inputOffset + chunk.byteLength > input.byteLength) {
    invalidInput = true
    return
  }
  input.set(chunk, inputOffset)
  inputOffset += chunk.byteLength
})
process.stdin.on("end", async () => {
  try {
    if (invalidInput || inputOffset !== input.byteLength) throw new Error("invalid input length")
    const options = process.argv.includes("--page-breaks")
      ? { pagerender: pageRender }
      : undefined
    const result = await pdfParse(input, options)
    send({ ok: true, result })
  } catch {
    send({ ok: false })
    process.exitCode = 2
  }
})
