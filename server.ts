import { ulid } from 'https://deno.land/std@0.210.0/ulid/mod.ts'

enum Color {
  Aqua = '#7fdbff',
  Blue = '#0074d9',
  Fuchsia = '#f012be',
  Gray = '#aaaaaa',
  Green = '#2ecc40',
  Lime = '#01ff70',
  Maroon = '#85144b',
  Navy = '#001f3f',
  Olive = '#3d9970',
  Orange = '#ff851b',
  Purple = '#b10dc9',
  Red = '#ff4136',
  Teal = '#39cccc',
  Yellow = '#ffdc00'
}

let category = ''
let connections = []
let isGameActive = false
let shapes = []
let word = ''


// Functions -------------------------------------------------------------------

function assignGM({ id }) {
  // TODO: Ensure there's no current GM

  connections = connections.map((conn) => {
    if (conn.id !== id) return conn
    return { ...conn, isGM: true }
  })

  return { ...users() }
}

function broadcast(data, filter) {
  const encodedData = JSON.stringify(data)
  for (const conn of connections) {
    if (!filter || filter(conn)) conn.socket.send(encodedData)
  }
}

function draw(xs) {
  if (xs.length < 1) return
  return xs[Math.floor(Math.random() * xs.length)]
}

function drawShape({ id, points }) {
  // TODO: Ensure user is active
  // TODO: Progress turn if in-game

  const { color } = connections.find((c) => c.id === id)
  shapes.push({ color, points })
  return { shapes }
}

function extract(...keys) {
  return (x) => keys.reduce((y, key) => ({
    ...y,
    [key]: x[key]
  }), {})
}

function registerUser({ id, name, socket }) {
  // TODO: Check for same name
  // TODO: Check for number of joined players
  // TODO: Check for in-progress game

  const color = Color.Gray
  connections.push({ color, id, name, playing: true, socket })

  return {
    category,
    color,
    id,
    shapes,
    word: '?',
    ...users()
  }
}

function scry(xs, pred) {
  return xs.reduce(([yes, no], x) => {
    if (pred(x)) return [yes.concat(x), no]
    return [yes, no.concat(x)]
  }, [[], []])
}

function unassignGM({ id }) {
  // TODO: Ensure requesting user is the GM

  connections = connections.map((conn) => {
    if (conn.id !== id) return conn
    return { ...conn, isGM: false }
  })

  return { ...users() }
}

function users() {
  const [gms, others] = scry(connections, ({ isGM }) => isGM)
  const [players, spectators] = scry(others, ({ playing }) => playing)
  const gameMaster = gms.at(0)

  return {
    gameMaster: gameMaster && { id: gameMaster.id, name: gameMaster.name },
    players: players.map(({ color, name }) => ({ color, name })),
    spectators: spectators.map(({ name }) => ({ name }))
  }
}


// Initialization --------------------------------------------------------------

Deno.serve((request) => {
  if (request.headers.get('upgrade') !== 'websocket') {
    return new Response('Not found', {
      headers: { 'Content-Type': 'text/plain' },
      status: 404
    })
  }

  const { response, socket } = Deno.upgradeWebSocket(request)
  const id = ulid()
  const send = (data) => socket.send(JSON.stringify(data))

  // socket.onerror
  // socket.onopen

  socket.onclose = () => {
    connections = connections.filter((c) => c.id !== id)
    broadcast({ ...users() })
  }

  socket.onmessage = (event) => {
    const { action, ...data } = JSON.parse(event.data)

    switch (action) {
      case 'become-gm':
        broadcast(assignGM({ id }))
        break
      case 'draw':
        broadcast(drawShape({ id, points: data.points }))
        break
      case 'register':
        send(registerUser({ id, name: data.name, socket }))
        broadcast({ ...users() }, (c) => c.id !== id)
        break
      case 'quit-gm':
        broadcast(unassignGM({ id }))
        break
    }
  }

  return response
})
