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

let activeIndex = -1
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
      color: conn.color,
      isActive: conn.isActive
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

  const role = isGameActive || roleUsers(Role.Player).length > 12
    ? Role.Spectator
    : Role.Player

  const color = 'gray'
  const isActive = !isGameActive
  connections.push({ color, id, isActive, role, name, socket })

  return {
    category,
    color,
    id,
    isActive,
    shapes,
    ...users()
  }
}

function roleUsers(userRole) {
  return connections.filter(({ role }) => role === userRole)
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

function shuffle(xs) {
  const ys = [...xs]
  let i = xs.length - 1
  for (i; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const y = ys[i]
    ys[i] = ys[j]
    ys[j] = y
  }
  return ys
}

function startGame({ id, word }) {
  // TODO: Ensure requesting user is the GM
  // TODO: Ensure there are enough players to play

  isGameActive = true
  shapes = []

  const colorPool = shuffle(colors)
  const players = roleUsers(Role.Player)
  const fakeArtistId = chooseRandom(players).id

  let orders = []
  for (let i = 0; i < players.length; i++) orders[i] = i
  orders = shuffle(orders)

  connections = connections.map((conn, i) => {
    if (conn.role === Role.Player) {
      conn.role = conn.id === fakeArtistId ? Role.FakeArtist : Role.Artist
      conn.color = colorPool[i]
      conn.order = orders[i]
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
  connections = connections.map((conn) => {
    conn.color = 'gray'
    if (conn.role === Role.Artist || conn.role === Role.FakeArtist) {
      conn.role = Role.Player
    }
    if (conn.order !== undefined) delete conn.order
  })

  return users()
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
  let gameMaster = connections.find(({ role }) => role === Role.GM)
  if (gameMaster) gameMaster = extract('id', 'name')(gameMaster)

  const players = connections
    .filter(({ role }) =>
      role === Role.Player ||
      role === Role.Artist ||
      role === Role.FakeArtist)
    .sort((a, b) => {
      if (isGameActive) return a.order < b.order ? -1 : 1
      return a.name < b.name ? -1 : 1
    })
    .map(extract('color', 'name'))

  const spectators = connections
    .filter(({ role }) => role === Role.Spectator)
    .sort((a, b) => a.name < b.name ? -1 : 1)
    .map(({ name }) => name)

  return { gameMaster, players, spectators }
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
