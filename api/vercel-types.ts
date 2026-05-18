export type VercelRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
  body?: any
}

export type VercelResponse = {
  status: (statusCode: number) => VercelResponse
  json: (body: any) => void
  send: (body: any) => void
  setHeader: (name: string, value: string | number | readonly string[]) => void
}
