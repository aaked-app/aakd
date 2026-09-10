import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { deflateSync } from "node:zlib"
import { createTextPdf } from "./pdf-fixture"

interface GrayImage {
  height: number
  pixels: Buffer
  width: number
}

function parsePgm(buffer: Buffer): GrayImage {
  let offset = 0
  const token = (): string => {
    while (offset < buffer.length) {
      if (buffer[offset] === 35) {
        while (offset < buffer.length && buffer[offset] !== 10) offset += 1
      } else if ([9, 10, 13, 32].includes(buffer[offset])) offset += 1
      else break
    }
    const start = offset
    while (offset < buffer.length && ![9, 10, 13, 32].includes(buffer[offset])) offset += 1
    return buffer.subarray(start, offset).toString("ascii")
  }

  if (token() !== "P5") throw new Error("Expected a binary grayscale raster")
  const width = Number(token())
  const height = Number(token())
  if (token() !== "255" || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error("Invalid grayscale raster metadata")
  }
  if (buffer[offset] === 13 && buffer[offset + 1] === 10) offset += 2
  else if ([9, 10, 32].includes(buffer[offset])) offset += 1
  const pixels = buffer.subarray(offset)
  if (pixels.length !== width * height) throw new Error("Incomplete grayscale raster")
  return { width, height, pixels }
}

function rasterizeTextPage(text: string): GrayImage {
  const directory = mkdtempSync(join(tmpdir(), "aakd-image-only-fixture-"))
  const source = join(directory, "source.pdf")
  const output = join(directory, "page")
  try {
    writeFileSync(source, createTextPdf([text]))
    execFileSync("pdftoppm", ["-singlefile", "-gray", "-r", "150", source, output], {
      env: { NODE_ENV: process.env.NODE_ENV ?? "test", PATH: process.env.PATH ?? "" },
      maxBuffer: 20 * 1024 * 1024,
      timeout: 20_000,
    })
    return parsePgm(readFileSync(`${output}.pgm`))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

export function createImageOnlyPdf(pages: string[]): Buffer {
  if (pages.length < 1) throw new Error("Image-only PDF fixture requires at least one page")
  const images = pages.map(rasterizeTextPage)
  const objects: Buffer[] = []
  const pageObjects = pages.map((_, index) => 3 + index * 3)
  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"))
  objects.push(Buffer.from(`<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`))
  for (const [index, gray] of images.entries()) {
    const pageId = pageObjects[index]
    const imageId = pageId + 1
    const contentId = pageId + 2
    const image = deflateSync(gray.pixels)
    const content = Buffer.from(`q ${gray.width} 0 0 ${gray.height} 0 0 cm /Im${index + 1} Do Q`)
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${gray.width} ${gray.height}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`))
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${gray.width} /Height ${gray.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.length} >>\nstream\n`), image, Buffer.from("\nendstream")]))
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")]))
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")]
  const offsets = [0]
  let length = chunks[0].length
  for (const [index, object] of objects.entries()) {
    offsets.push(length)
    const framed = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n")])
    chunks.push(framed)
    length += framed.length
  }
  const xrefOffset = length
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  trailer += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(trailer))
  return Buffer.concat(chunks)
}
