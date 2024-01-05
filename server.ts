import { ulid } from 'https://deno.land/std@0.210.0/ulid/mod.ts'

enum Role {
  Artist = 'artist',
  FakeArtist = 'fake artist',
  GM = 'gm',
  Player = 'player',
  Spectator = 'spectator'
}

const colors = [
  'aqua',
  'blue',
  'fuchsia',
  'green',
  'lime',
  'maroon',
  'navy',
  'olive',
  'orange',
  'purple',
  'red',
  'teal',
  'yellow'
]

let category = ''
let connections = []
let isGameActive = false
let shapes = []


// Functions -------------------------------------------------------------------

function assignGM({ id }) {
  // TODO: Ensure there's no current GM

  connections = connections.map((conn) => {
    if (conn.id !== id) return conn
    return { ...conn, role: Role.GM }
  })

  return users()
}

function broadcast(data, filter) {
  for (const conn of connections) {
    if (!filter || filter(conn)) conn.socket.send(JSON.stringify({
      ...data,
      color: conn.color
    }))
  }
}

function chooseRandom(xs) {
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

  const color = 'gray'
  connections.push({ color, id, role: Role.Player, name, socket })

  return {
    category,
    color,
    id,
    shapes,
    ...users()
  }
}

function scry(xs, pred) {
  return xs.reduce(([yes, no], x) => {
    if (pred(x)) return [yes.concat(x), no]
    return [yes, no.concat(x)]
  }, [[], []])
}

function setCategory({ id, value }) {
  category = value
  return { category }
}

function startGame({ id, word }) {
  // TODO: Ensure requesting user is the GM
  // TODO: Ensure there are enough players to play

  isGameActive = true
  shapes = []

  const colorPool = [...colors]
  const fakeArtistId = chooseRandom(usersByRole(Role.Player)).id

  connections = connections.map((conn) => {
    if (conn.role === Role.Player) {
      conn.role = conn.id === fakeArtistId ? Role.FakeArtist : Role.Artist
      conn.color = takeRandom(colorPool)
    }

    return conn
  })

  const data = { shapes, ...users() }

  return [
    { ...data, word }, // Artist/GM data
    { ...data, word: '?' } // Non-artist data
  ]
}

function stopGame({ id }) {
  // TODO: Ensure requesting user is the GM

  isGameActive = false

  return unassignGM(id)
}

function takeRandom(xs) {
  return xs.splice(Math.floor(Math.random() * xs.length), 1).at(0)
}

function unassignGM({ id }) {
  // TODO: Ensure requesting user is the GM

  connections = connections.map((conn) => {
    if (conn.id !== id) return conn
    return { ...conn, role: Role.Player }
  })

  category = ''

  return { category, word: '', ...users() }
}

function unregisterUser({ id }) {
  // TODO: Check if they're GM
  // TODO: Check if they're the fake artist

  connections = connections.filter((c) => c.id !== id)
  broadcast(users())
}

function users() {
  const [gms, others] = scry(connections, ({ role }) => role === Role.GM)
  const [players, spectators] = scry(others, ({ role }) => role === Role.Player || role === Role.Artist || role === Role.FakeArtist)
  const gameMaster = gms.at(0)

  return {
    gameMaster: gameMaster
      ? { id: gameMaster.id, name: gameMaster.name }
      : null,
    players: players.map(({ color, name }) => ({ color, name })),
    spectators: spectators.map(({ name }) => ({ name }))
  }
}

function usersByRole(userRole) {
  return connections.filter(({ role }) => role === userRole)
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

  socket.onclose = () => {
    broadcast(unregisterUser({ id }))
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
        broadcast(users(), (c) => c.id !== id)
        break
      case 'quit-gm':
        broadcast(unassignGM({ id }))
        break
      case 'set-category':
        broadcast(setCategory({ id, value: data.value }))
        break
      case 'start':
        const [artistData, nonArtistData] = startGame({ id, word: data.word })
        broadcast(artistData, ({ role }) => role === Role.Artist || role === Role.GM)
        broadcast(nonArtistData, ({ role }) => role !== Role.Artist && role !== Role.GM)
        break
      case 'stop':
        broadcast(stopGame({ id }))
        break
    }
  }

  return response
})
