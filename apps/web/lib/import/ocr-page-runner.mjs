import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { createWorker, OEM } from "tesseract.js"

const EXPECTED_MODEL_SHA256 = "5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747"
const EXPECTED_MODEL_BYTES = 5_199_098

function value(name) {
  const prefix = `--${name}=`
  const argument = process.argv.find((entry) => entry.startsWith(prefix))
  if (!argument) throw new Error("Invalid OCR runner arguments")
  return argument.slice(prefix.length)
}

async function main() {
  const modelPath = value("model")
  const outputDirectory = value("output-directory")
  const maxTextBytes = Number(value("max-text-bytes"))
  const images = process.argv.filter((entry) => entry.startsWith("--image=")).map((entry) => entry.slice(8))
  if (!Number.isSafeInteger(maxTextBytes) || maxTextBytes < 1 || images.length < 1) {
    throw new Error("Invalid OCR runner arguments")
  }

  const modelStats = await fs.stat(modelPath)
  if (!modelStats.isFile() || modelStats.size !== EXPECTED_MODEL_BYTES) {
    throw new Error("OCR model integrity check failed")
  }
  const model = await fs.readFile(modelPath)
  if (crypto.createHash("sha256").update(model).digest("hex") !== EXPECTED_MODEL_SHA256) {
    throw new Error("OCR model integrity check failed")
  }

  let worker
  let totalTextBytes = 0
  try {
    worker = await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: path.dirname(modelPath),
      cacheMethod: "none",
      gzip: false,
    })
    for (const [index, image] of images.entries()) {
      const result = await worker.recognize(image)
      const text = (result.data.text || "").trim()
      totalTextBytes += Buffer.byteLength(text, "utf8")
      if (totalTextBytes > maxTextBytes) throw new Error("OCR text exceeds its resource limit")
      await fs.writeFile(path.join(outputDirectory, `page-${index + 1}.txt`), text, { flag: "wx" })
    }
  } finally {
    if (worker) await worker.terminate()
  }
}

main().catch(() => {
  process.exitCode = 1
})
