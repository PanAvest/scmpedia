/// <reference types="vite/client" />

declare module 'papaparse' {
  const Papa: {
    parse<T = Record<string, unknown>>(
      input: string,
      config?: {
        header?: boolean
        skipEmptyLines?: boolean
      },
    ): { data: T[] }
  }
  export default Papa
}
