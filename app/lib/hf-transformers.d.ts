/**
 * Ambient type shim for @huggingface/transformers.
 * The package's ./types/transformers.d.ts is referenced in package.json but not
 * shipped in the npm tarball for v3.x. This shim declares the surface we use so
 * `tsc --noEmit` passes without needing the full library types.
 */
declare module "@huggingface/transformers" {
  type ProgressStatus = "initiate" | "download" | "progress" | "done" | "ready";

  interface ProgressInfo {
    status: ProgressStatus;
    name?: string;
    file?: string;
    progress?: number;
    loaded?: number;
    total?: number;
  }

  interface PipelineOptions {
    progress_callback?: (info: ProgressInfo) => void;
    device?: string;
    dtype?: string;
  }

  interface DetectionBox {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  }

  interface DetectionResult {
    label: string;
    score: number;
    box: DetectionBox;
  }

  interface ObjectDetectionPipeline {
    (
      input: HTMLCanvasElement | HTMLImageElement | ImageData | string | Blob | File,
      options?: { threshold?: number }
    ): Promise<DetectionResult[]>;
  }

  export function pipeline(
    task: "object-detection",
    model: string,
    options?: PipelineOptions
  ): Promise<ObjectDetectionPipeline>;

  export const env: {
    allowLocalModels: boolean;
    allowRemoteModels: boolean;
    backends: {
      onnx: {
        wasm: {
          wasmPaths?: string;
          numThreads?: number;
        };
      };
    };
    cacheDir?: string;
    useFSCache?: boolean;
    useCustomCache?: boolean;
  };
}
