const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

// Elements
const canvas = $('canvas')
const gamePage = $('section[data-page="game"]')
const joinButton = $('#Join')
const nameInput = $('#Name')
const playersList = $('#Players')
const registrationForm = $('#RegistrationForm')
const registrationPage = $('section[data-page="registration"]')
const spectatorsList = $('#Spectators')
const spectatorsTitle = $('#SpectatorsTitle')

// Globals
const context = canvas.getContext('2d')
// TODO const websocket = new WebSocket('ws://localhost:8080')

const testShapes = [
  {
    color: '',
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

// Local state
let drawing = false // Flag for drawing motion
let points = [] // Points of local drawn stroke
let state = {
  category: '',
  color: null,
  gameMasterName: null,
  id: null,
  players: [],
  shapes: testShapes, // FIXME: Use data from server, initially []
  spectators: [],
  word: ''
}

/* Test drawing
*/

// Functions -------------------------------------------------------------------

function disable(...elements) {
  elements.forEach((element) => {
    element.setAttribute('disabled', '')
  })
}

function enable(...elements) {
  elements.forEach((element) => {
    element.removeAttribute('disabled')
  })
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
  // TODO: Get initial state from server side

  return new Promise((resolve) => {
    resolve({
      gameMasterName: 'Master of the Game',
      id: crypto.randomUUID(),
      players: [
        { name }
      ]
    })
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
  // TODO: Send points
}

function tryWebSocket() {
  // TODO: Open and monitor WebSocket connection with promises
}

function update(newState) {
  state = { ...state, newState }
  // TODO: Update elements with new state data

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

registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  disable(nameInput, joinButton)
  try {
    const initialState = await register(nameInput.value))
    update(initialState)
    hide(registrationPage)
    show(gamePage)
  } catch (error) {
    // TODO: Handle displaying error message
    console.error(error)
    enable(nameInput, joinButton)
  }
})


// Initialization --------------------------------------------------------------

context.lineWidth = 5
context.strokeStyle = '#7fdbff' // FIXME

show(registrationPage)
