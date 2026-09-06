export async function minifyCode(input: string, type: "js" | "css" | "html"): Promise<string> {
  if (type === "js") {
    const { minify } = await import("terser");
    const result = await minify(input, { compress: false, mangle: false });
    return result.code ?? "";
  }
  if (type === "css") {
    const { parse, generate } = await import("css-tree");
    return generate(parse(input, { onParseError(error) { throw error; } }));
  }
  const { minify } = await import("html-minifier-terser/dist/htmlminifier.esm.bundle");
  // Keep text whitespace and embedded code intact; only remove ordinary comments.
  return minify(input, { removeComments: true, collapseWhitespace: false, minifyCSS: false, minifyJS: false });
}
