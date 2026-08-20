import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

const cacheDir = join(dirname(fileURLToPath(import.meta.url)), '../../.cache/huggingface')
env.cacheDir = cacheDir
env.allowLocalModels = true

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'

let extractor: FeatureExtractionPipeline | undefined

export async function embed(text: string): Promise<Float32Array> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', EMBEDDING_MODEL, {
      dtype: 'fp32',
    })
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Float32Array.from(output.data as Iterable<number>)
}

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
  }
  return dot
}
