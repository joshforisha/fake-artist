const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

// Elements
const becomeGMButton = $('#BecomeGM')
const canvas = $('canvas')
const categoryInput = $('#Category')
const gameMastersList = $('#GameMasters')
const gamePage = $('section[data-page="game"]')
const joinButton = $('#Join')
const nameInput = $('#Name')
const playersList = $('#Players')
const registrationForm = $('#RegistrationForm')
const registrationPage = $('section[data-page="registration"]')
const spectatorsList = $('#Spectators')
const spectatorsTitle = $('#SpectatorsTitle')
const startButton = $('#Start')
const stopButton = $('#Stop')
const quitGMButton = $('#QuitGM')
const wordInput = $('#Word')

// Globals
const context = canvas.getContext('2d')
let webSocket

// Local state
let drawing = false // Flag for drawing motion
let points = [] // Points of local drawn stroke
const initialState = {
  category: '',
  color: '#aaaaaa',
  gameMaster: null,
  id: null,
  players: [],
  shapes: [],
  spectators: [],
  word: ''
}
let state = initialState


// Functions -------------------------------------------------------------------

function disable(...elements) {
  elements.forEach((element) => {
    element.setAttribute('disabled', '')
  })
}

function disableAndHide(...elements) {
  disable(...elements)
  hide(...elements)
}

function enable(...elements) {
  elements.forEach((element) => {
    element.removeAttribute('disabled')
  })
}

function enableAndShow(...elements) {
  enable(...elements)
  show(...elements)
}

function h(elementType, attributes = {}, children = []) {
  const element = document.createElement(elementType)
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'textContent') element.textContent = value
    else element.setAttribute(key, value)
  }
  for (const child of children) {
    element.appendChild(child)
  }
  return element
}

function hide(...elements) {
  elements.forEach((element) => {
    element.setAttribute('data-hidden', '')
  })
}

function moveDrawing(event) {
  if (!drawing) return

  context.lineTo(event.offsetX, event.offsetY)
  context.stroke()
  points.push([event.offsetX, event.offsetY])
}

function register(name) {
  send({
    action: 'register',
    name
  })
}

function send(data) {
  if (!webSocket) return new Promise.reject()
  const encodedData = JSON.stringify({ ...data, id: state.id })
  return new Promise((resolve) => {
    if (webSocket.readyState === 1) {
      webSocket.send(encodedData)
      resolve()
    }

    webSocket.addEventListener('open', () => {
      webSocket.send(encodedData)
      resolve()
    }, { once: true })
  })
}

function show(...elements) {
  elements.forEach((element) => {
    element.removeAttribute('data-hidden')
  })
}

function startDrawing(event) {
  drawing = true
  context.beginPath()
  context.moveTo(event.offsetX, event.offsetY)
  context.stroke()
  points = [[event.offsetX, event.offsetY]]
}

function stopDrawing(event) {
  if (!drawing) return

  drawing = false
  send({ action: 'draw', points })
}

function tryToConnect() {
  webSocket = new WebSocket('ws://localhost:8000')

  webSocket.addEventListener('close', () => {
    hide(registrationPage, gamePage)
    state = initialState
    setTimeout(tryToConnect, 3000)
  })

  webSocket.addEventListener('message', ({ data }) => {
    hide(registrationPage)
    show(gamePage)
    update(data)
  })

  webSocket.addEventListener('open', () => {
    enable(nameInput, joinButton)
    show(registrationPage)
    nameInput.focus()
    // joinButton.click() // FIXME
  })
}

function update(newState) {
  state = { ...state, ...JSON.parse(newState) }
  console.log(state)

  // Prompts
  categoryInput.value = state.category

  // Canvas
  context.clearRect(0, 0, 640, 640)
  for (const { color, points } of state.shapes) {
    context.strokeStyle = color
    context.beginPath()
    context.moveTo(points[0][0], points[0][1])
    for (const [x, y] of points.slice(1)) {
      context.lineTo(x, y)
      context.stroke()
    }
  }
  context.strokeStyle = state.color

  // Game Master
  gameMastersList.innerHTML = ''
  disableAndHide(becomeGMButton, startButton, stopButton, quitGMButton)
  if (state.gameMaster) {
    gameMastersList.appendChild(h('li', {
      textContent: state.gameMaster.name
    }))
    if (state.gameMaster.id === state.id) {
      enableAndShow(startButton)
    }
  } else {
    enableAndShow(becomeGMButton)
  }

  // Players
  playersList.innerHTML = ''
  for (const { name } of state.players) {
    playersList.appendChild(h('li', { textContent: name }))
  }

  // Spectators
  if (state.spectators.length > 0) {
    spectatorsList.innerHTML = ''
    for (const spectator of state.spectators) {
      spectatorsList.appendChild(h('li', { textContent: spectator }))
    }
    show(spectatorsTitle, spectatorsList)
  } else {
    hide(spectatorsTitle, spectatorsList)
  }
}


// Events ----------------------------------------------------------------------

registrationForm.addEventListener('submit', (event) => {
  event.preventDefault()
  disable(nameInput, joinButton)
  send({ action: 'register', name: nameInput.value })
})

canvas.addEventListener('pointercancel', stopDrawing)
canvas.addEventListener('pointerdown', startDrawing)
canvas.addEventListener('pointerleave', stopDrawing)
canvas.addEventListener('pointermove', moveDrawing)
canvas.addEventListener('pointerout', stopDrawing)
canvas.addEventListener('pointerup', stopDrawing)
canvas.addEventListener('touchcancel', stopDrawing)
canvas.addEventListener('touchend', stopDrawing)
canvas.addEventListener('touchmove', moveDrawing)
canvas.addEventListener('touchstart', startDrawing)

nameInput.addEventListener('input', (event) => {
  const value = event.target.value
  if (value.length < 1 || value.startsWith(' ') || value.endsWith(' ')) {
    disable(joinButton)
  }
  else enable(joinButton)
})

becomeGMButton.addEventListener('click', () => {
  send({ action: 'become-gm' })
})

quitGMButton.addEventListener('click', () => {
  send({ action: 'quit-gm' })
})


// Initialization --------------------------------------------------------------

context.lineWidth = 5
context.strokeStyle = state.color

tryToConnect()
