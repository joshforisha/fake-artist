import { ulid } from 'https://deno.land/std@0.210.0/ulid/mod.ts'

enum Color {
  Aqua = '#7fdbff',
  Blue = '#0074d9',
  Fuchsia = '#f012be',
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

const shapes = [
  {
    color: draw(Object.values(Color)),
    points: [
      [374, 131], [374, 131], [376, 130], [377, 129], [378, 129], [380, 128],
      [382, 127], [383, 127], [385, 127], [387, 126], [388, 126], [390, 126],
      [391, 126], [393, 126], [394, 127], [396, 127], [399, 129], [402, 132],
      [405, 136], [407, 141], [409, 147], [411, 152], [412, 157], [412, 161],
      [412, 163], [412, 164], [412, 165], [412, 166], [412, 167], [412, 167],
      [411, 168], [410, 169], [408, 170], [406, 170], [405, 171], [403, 172],
      [400, 172], [398, 172], [396, 172], [394, 172], [392, 172], [391, 172],
      [389, 171], [388, 171], [387, 169], [385, 168], [384, 167], [383, 165],
      [382, 163], [381, 161], [380, 160], [379, 158], [379, 156], [378, 154],
      [377, 152], [377, 150], [376, 149], [376, 147], [375, 146], [375, 144],
      [374, 143], [374, 141], [374, 140], [373, 138], [372, 136], [372, 135],
      [372, 133], [371, 132], [371, 131], [371, 130], [370, 129], [370, 128],
      [370, 128], [370, 127], [370, 127]
    ]
  }
]

let category = ''
let connections = []
let isGameActive = false
let word = ''


// Functions -------------------------------------------------------------------

function assignGM({ id, name }) {
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

  connections.push({ id, name, playing: true, socket })

  return {
    category,
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

function unassignGM({ id, name }) {
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
        broadcast(assignGM({ id, socket }))
        break
      case 'register':
        send(registerUser({ id, name: data.name, socket }))
        broadcast({ ...users() }, (c) => c.id !== id)
        break
      case 'quit-gm':
        broadcast(unassignGM({ id, socket }))
        break
    }
  }

  return response
})
