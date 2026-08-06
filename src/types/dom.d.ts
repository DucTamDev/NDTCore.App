// TypeScript's bundled lib.dom.d.ts does not model FontFaceSet as
// Setlike<FontFace>, so `add`/`delete`/`has` are missing from the type
// even though every browser's real FontFaceSet implements them per spec.
// https://github.com/microsoft/TypeScript/issues/30119
interface FontFaceSet {
  add(font: FontFace): FontFaceSet;
}
