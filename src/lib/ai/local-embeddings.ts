// Client-side local vector embeddings generation using Hugging Face Transformers
import { pipeline, env } from "@huggingface/transformers";

// Configure Transformers.js to not search for local model files
if (typeof window !== "undefined") {
  env.allowLocalModels = false;
}

let extractorInstancePromise: any = null;

async function getExtractor() {
  if (extractorInstancePromise) {
    return extractorInstancePromise;
  }

  extractorInstancePromise = (async () => {
    try {
      console.log("Attempting to initialize embeddings pipeline with WebGPU...");
      const extractor = await pipeline(
        "feature-extraction",
        "onnx-community/all-MiniLM-L6-v2-ONNX",
        {
          device: "webgpu",
        }
      );
      console.log("Successfully initialized embeddings pipeline using WebGPU.");
      return extractor;
    } catch (gpuError) {
      console.warn(
        "WebGPU embeddings initialization failed, falling back to WASM:",
        gpuError
      );
      try {
        const extractor = await pipeline(
          "feature-extraction",
          "onnx-community/all-MiniLM-L6-v2-ONNX",
          {
            device: "wasm",
          }
        );
        console.log("Successfully initialized embeddings pipeline using WASM.");
        return extractor;
      } catch (wasmError) {
        console.error("WASM fallback failed as well:", wasmError);
        throw new Error(
          "Could not initialize local embedding pipeline with WebGPU or WASM. " +
            String(wasmError)
        );
      }
    }
  })();

  return extractorInstancePromise;
}

/**
 * Generates a 384-dimension vector embedding for the given text
 * completely client-side in the browser.
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  
  // Extract features (mean pooling and L2 normalization return a high-quality 384-dim sentence embedding)
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  // Convert Hugging Face Tensor to flat standard JS array of numbers
  const embedding = Array.from(output.data) as number[];
  
  if (embedding.length !== 384) {
    console.warn(`Expected embedding dimension of 384, but got ${embedding.length}`);
  }
  
  return embedding;
}
