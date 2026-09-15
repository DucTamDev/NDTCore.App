/**
 * Parameter-object form of an RGBA image (data + dimensions), for callers that prefer
 * passing a single object instead of separate positional arguments.
 */
export interface ImageSource {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}
