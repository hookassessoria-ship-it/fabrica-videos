// `require.context` do bundler (Rspack/Webpack), usado pra registrar
// automaticamente todo JSON em /videos e /brands.
declare namespace NodeJS {
  interface RequireContext {
    keys(): string[];
    (id: string): unknown;
  }
  interface Require {
    context(directory: string, useSubdirectories: boolean, regExp: RegExp): RequireContext;
  }
}
