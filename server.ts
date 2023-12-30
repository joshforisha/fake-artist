function makeResponse({ body, contentType, status = 200 }) {
  return new Response(body, {
    headers: {
      'Content-Type': contentType
    },
    status
  })
}

Deno.serve((request) => {
  const url = new URL(request.url)
  const params = url.searchParams
  const req = `${request.method} ${url.pathname}`

  switch (req) {
    default:
      return makeResponse({ body: `Not found (${req})`, status: 404 })
  }
})
