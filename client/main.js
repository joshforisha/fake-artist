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
const HexColor = {
  aqua: '#7fdbff',
  black: '#111111',
  blue: '#0074d9',
  fuchsia: '#f012be',
  gray: '#aaaaaa',
  green: '#2ecc40',
  lime: '#01ff70',
  maroon: '#85144b',
  navy: '#001f3f',
  olive: '#3d9970',
  orange: '#ff851b',
  purple: '#b10dc9',
  red: '#ff4136',
  silver: '#dddddd',
  teal: '#39cccc',
  white: '#ffffff',
  yellow: '#ffdc00'
}
const context = canvas.getContext('2d')
let webSocket

// Local state
let drawing = false // Flag for drawing motion
let points = [] // Points of local drawn stroke
const initialState = {
  category: '',
  color: 'gray',
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
    switch (key) {
      case 'class':
        element.classList.add(value)
        break
      case 'textContent':
        element.textContent = value
        break
      default:
        element.setAttribute(key, value)
    }
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

function toggle(pred, ...elements) {
  if (pred) enable(...elements)
  else disable(...elements)
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

    // FIXME (Temporary testing)
    nameInput.value = 'Josh'
    joinButton.click()
  })
}

function update(newState) {
  if (newState) state = { ...state, ...JSON.parse(newState) }
  console.log(state)

  // Prompts
  categoryInput.value = state.category

  // Canvas
  context.clearRect(0, 0, 640, 640)
  for (const { color, points } of state.shapes) {
    context.strokeStyle = HexColor[color]
    context.beginPath()
    context.moveTo(points[0][0], points[0][1])
    for (const [x, y] of points.slice(1)) {
      context.lineTo(x, y)
      context.stroke()
    }
  }
  context.strokeStyle = HexColor[state.color]

  // Game Master
  gameMastersList.innerHTML = ''
  disableAndHide(becomeGMButton, startButton, stopButton, quitGMButton)
  if (state.gameMaster) {
    gameMastersList.appendChild(h('li', {
      textContent: state.gameMaster.name
    }))
    if (state.gameMaster.id === state.id) {
      enable(categoryInput, wordInput)
      enableAndShow(quitGMButton)
      toggle(validText(state.category) && validText(wordInput.value), startButton)
      show(startButton)
    } else {
      wordInput.value = state.word
    }
  } else {
    disable(categoryInput, wordInput)
    enableAndShow(becomeGMButton)
  }

  // Players
  playersList.innerHTML = ''
  if (state.players.length < 1) {
    playersList.appendChild(h('li', { class: 'empty', textContent: 'No one yet!' }))
  } else {
    for (const { color, name } of state.players) {
      playersList.appendChild(h('li', { class: color, textContent: name }))
    }
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

function validText(string) {
  if (string.length < 1) return false
  if (string.startsWith(' ')) return false
  if (string.endsWith(' ')) return false
  return true
}


// Events ----------------------------------------------------------------------

registrationForm.addEventListener('submit', (event) => {
  event.preventDefault()
  disable(nameInput, joinButton)
  send({ action: 'register', name: nameInput.value })
})

categoryInput.addEventListener('input', (event) => {
  send({ action: 'set-category', value: event.target.value })
})

wordInput.addEventListener('input', (event) => {
  update()
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
  if (validText(event.target.value)) enable(joinButton)
  else disable(joinButton)
})

becomeGMButton.addEventListener('click', () => {
  send({ action: 'become-gm' })
})

startButton.addEventListener('click', () => {
  send({ action: 'start', word: wordInput.value })
})

stopButton.addEventListener('click', () => {
  send({ action: 'stop' })
})

quitGMButton.addEventListener('click', () => {
  send({ action: 'quit-gm' })
})


// Initialization --------------------------------------------------------------

context.lineWidth = 5
context.strokeStyle = HexColor[state.color]

tryToConnect()
