/* =========================================================
   Hungry Hippo Pizzas: staff site
   Kitchen bump screen, time clock, schedule, inventory,
   recipes, and (manager only) reports and forecasting.
   ========================================================= */

HH.seedIfNeeded()

const $ = sel => document.querySelector(sel)
const $$ = sel => Array.from(document.querySelectorAll(sel))
const C = HH.CONFIG
const swal = HH.makeDialog()

const SESSION_KEY = 'hh2_staff_session' // sessionStorage: signs out when the tab closes
let me = null
let currentView = 'kitchen'
let lastBump = null
let weekOffset = 0
let charts = {}
let kitchenKeys = []

const isManager = () => me && me.role === 'manager'
const cupLabel = n => ({ 0.25: '¼ cup', 0.5: '½ cup', 0.75: '¾ cup', 1: '1 cup' }[n] || `${n} cups`)
const minsBetween = (a, b) => (b - a) / 60000

// ================= Sign in =================
function renderPinPad () {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Enter']
  $('#divPinPad').innerHTML = keys.map(k => `<button type="button" data-key="${k}" ${k.length > 1 ? 'style="font-size:1.1rem"' : ''}>${k}</button>`).join('')
}
function updateDots () {
  const n = $('#txtPin').value.length
  $$('#divPinDots span').forEach((s, i) => s.classList.toggle('filled', i < n))
}
$('#divPinPad').addEventListener('click', e => {
  const b = e.target.closest('[data-key]')
  if (!b) return
  const pin = $('#txtPin')
  if (b.dataset.key === 'Clear') pin.value = ''
  else if (b.dataset.key === 'Enter') return tryLogin()
  else if (pin.value.length < 4) pin.value += b.dataset.key
  updateDots()
  if (pin.value.length === 4) tryLogin()
})
$('#txtPin').addEventListener('input', () => {
  updateDots()
  if ($('#txtPin').value.length === 4) tryLogin()
})
function tryLogin () {
  const emp = HH.employeeByPin($('#txtPin').value)
  $('#txtPin').value = ''
  updateDots()
  if (!emp) {
    swal.fire({ icon: 'error', title: 'PIN not recognized', text: 'Try again, or ask Luigi to check your PIN.' })
    return
  }
  sessionStorage.setItem(SESSION_KEY, emp.id)
  startSession()
}
function signOut () {
  sessionStorage.removeItem(SESSION_KEY)
  me = null
  $('#navStaff').hidden = true
  $('#divWho').innerHTML = ''
  $$('.view').forEach(v => { v.hidden = v.id !== 'viewLogin' })
  $('#txtPin').focus()
}
function startSession () {
  me = HH.findEmployee(sessionStorage.getItem(SESSION_KEY))
  if (!me) return signOut()
  $('#navStaff').hidden = false
  $$('[data-manager]').forEach(el => { el.hidden = !isManager() })
  $('#divWho').innerHTML = `<span>${HH.escapeHtml(me.name)}${isManager() ? ' (manager)' : ''}</span>
    <button type="button" class="btn btn-secondary btn-small" id="btnSignOut" style="background:transparent;color:#fff;border-color:#fff">Sign out</button>`
  $('#btnSignOut').addEventListener('click', signOut)
  showView(currentView === 'reports' && !isManager() ? 'kitchen' : currentView)
}

// ================= Views =================
function showView (name) {
  if (name === 'reports' && !isManager()) name = 'kitchen'
  currentView = name
  $$('.view').forEach(v => { v.hidden = v.id !== 'view' + name[0].toUpperCase() + name.slice(1) })
  $$('#navStaff .tab').forEach(t => {
    if (t.dataset.view === name) t.setAttribute('aria-current', 'page')
    else t.removeAttribute('aria-current')
  })
  render()
}
$$('#navStaff .tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)))

function render () {
  if (!me) return
  ;({
    kitchen: renderKitchen,
    clock: renderClock,
    schedule: renderSchedule,
    inventory: renderInventory,
    recipes: renderRecipes,
    reports: renderReports
  })[currentView]()
}

// ================= Kitchen bump screen =================
function fireAt (o) {
  return o.pickupAt ? o.pickupAt - 25 * 60000 : o.placedAt
}
function ticketHtml (o, key) {
  const st = HH.STATUSES[HH.statusIndex(o.status)]
  const pizzas = o.items.filter(i => i.kind === 'pizza')
  const drinks = o.items.filter(i => i.kind === 'drink')
  return `
    <article class="ticket status-${o.status}" aria-labelledby="t${o.id}">
      <header class="ticket-head">
        ${key ? `<span class="ticket-key" aria-hidden="true">${key}</span>` : ''}
        <h3 class="ticket-num" id="t${o.id}">#${o.number}</h3>
        <span class="ticket-timer" data-since="${o.placedAt}" aria-label="Time since order"></span>
      </header>
      <div class="ticket-body">
        <div class="ticket-meta">
          <span class="tag">${st.staff}</span>
          <span class="tag ${o.type === 'dinein' ? 'dinein' : ''}">${o.type === 'dinein' ? 'Dine in' + (o.table ? ', table ' + HH.escapeHtml(o.table) : '') : 'Pickup'}</span>
          ${o.pickupAt ? `<span class="tag">Due ${HH.timeLabel(o.pickupAt)}</span>` : ''}
        </div>
        <div><strong>${HH.escapeHtml(o.name)}</strong></div>
        <ul class="ticket-items">
          ${pizzas.map(i => `<li><strong>${i.qty} × ${HH.size(i.size).name} ${HH.size(i.size).inches}″</strong><br>${HH.itemDetail(i)}</li>`).join('')}
          ${drinks.map(i => `<li>${i.qty} × ${HH.itemTitle(i)}</li>`).join('')}
        </ul>
        ${o.notes ? `<div class="ticket-notes">Note: ${HH.escapeHtml(o.notes)}</div>` : ''}
      </div>
      ${st.bump ? `<div class="ticket-foot"><button type="button" class="btn ${o.status === 'oven' ? 'btn-green' : 'btn-primary'}" data-bump="${o.id}">Bump: ${st.bump}</button></div>` : ''}
    </article>`
}

function renderKitchen () {
  const now = Date.now()
  const orders = HH.getOrders()
  const active = orders.filter(o => HH.ACTIVE.includes(o.status))
  const making = active.filter(o => o.status !== 'ready' && !HH.isLater(o, now)).sort((a, b) => fireAt(a) - fireAt(b))
  const ready = active.filter(o => o.status === 'ready').sort((a, b) => a.t.ready - b.t.ready)
  const later = active.filter(o => HH.isLater(o, now)).sort((a, b) => a.pickupAt - b.pickupAt)
  kitchenKeys = [...making, ...ready].slice(0, 9).map(o => o.id)

  const inOven = HH.pizzasIn(orders, ['oven'])
  const todayKey = HH.dateKey(now)
  const todays = orders.filter(o => HH.dateKey(o.placedAt) === todayKey)
  const timed = todays.filter(o => o.t.ready && !o.pickupAt)
  const avgTicket = timed.length ? Math.round(timed.reduce((s, o) => s + minsBetween(o.t.received, o.t.ready), 0) / timed.length) : 0
  const pctOven = Math.min(100, Math.round(inOven / C.oven.capacity * 100))

  $('#divKitchenStats').innerHTML = `
    <div class="stat"><div class="stat-value">${making.length}</div><div class="stat-label">Orders to make</div></div>
    <div class="stat"><div class="stat-value">${inOven} of ${C.oven.capacity}</div><div class="stat-label">Oven spots in use</div>
      <div class="oven-meter" role="progressbar" aria-label="Oven spots in use" aria-valuemin="0" aria-valuemax="${C.oven.capacity}" aria-valuenow="${inOven}"><span style="width:${pctOven}%"></span></div></div>
    <div class="stat"><div class="stat-value">${ready.length}</div><div class="stat-label">Ready, waiting</div></div>
    <div class="stat"><div class="stat-value">${avgTicket ? avgTicket + ' min' : 'None yet'}</div><div class="stat-label">Average order time today</div></div>
    <div class="stat"><div class="stat-value">${todays.length}</div><div class="stat-label">Orders today</div></div>`

  let n = 0
  $('#divTickets').innerHTML = making.length ? making.map(o => ticketHtml(o, ++n <= 9 ? n : '')).join('') : '<p class="empty">No orders to make right now.</p>'
  $('#divReady').innerHTML = ready.length ? ready.map(o => ticketHtml(o, ++n <= 9 ? n : '')).join('') : '<p class="empty">Nothing waiting.</p>'
  $('#divLater').innerHTML = later.length ? later.map(o => ticketHtml(o, '')).join('') : '<p class="empty">No scheduled orders.</p>'
  $('#btnUndo').disabled = !lastBump
  tickTimers()
}

function tickTimers () {
  const now = Date.now()
  $$('.ticket-timer').forEach(el => {
    const mins = minsBetween(Number(el.dataset.since), now)
    const m = Math.floor(mins)
    const s = Math.floor((mins - m) * 60)
    el.textContent = m >= 100 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s).padStart(2, '0')}`
    el.classList.toggle('warn', mins >= 12 && mins < 20)
    el.classList.toggle('late', mins >= 20)
  })
}

async function bump (id) {
  const order = HH.findOrder(id)
  if (!order) return
  const idx = HH.statusIndex(order.status)
  const next = HH.STATUSES[idx + 1]
  if (!next) return
  if (next.id === 'oven') {
    const inOven = HH.pizzasIn(HH.getOrders(), ['oven'])
    const adding = HH.countPizzas(order.items)
    if (inOven + adding > C.oven.capacity) {
      const answer = await swal.fire({
        icon: 'warning',
        title: 'Oven is full',
        text: `${inOven} of ${C.oven.capacity} spots are in use and this order has ${adding} pizza${adding > 1 ? 's' : ''}. Put it in anyway?`,
        showCancelButton: true,
        confirmButtonText: 'Put it in anyway',
        cancelButtonText: 'Wait'
      })
      if (!answer.isConfirmed) return
    }
  }
  lastBump = { id, from: order.status, number: order.number }
  HH.setStatus(id, next.id)
}

$('#viewKitchen').addEventListener('click', e => {
  const b = e.target.closest('[data-bump]')
  if (b) bump(b.dataset.bump)
})
$('#btnUndo').addEventListener('click', () => {
  if (!lastBump) return
  HH.setStatus(lastBump.id, lastBump.from)
  lastBump = null
})
// Bump bar keys: 1 to 9 bump that ticket
document.addEventListener('keydown', e => {
  if (!me || currentView !== 'kitchen' || e.ctrlKey || e.metaKey || e.altKey) return
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
  if (/^[1-9]$/.test(e.key) && kitchenKeys[Number(e.key) - 1]) {
    e.preventDefault()
    bump(kitchenKeys[Number(e.key) - 1])
  }
})

// ================= Time clock =================
function renderClock () {
  const now = Date.now()
  const punches = HH.getPunches()
  const open = punches.find(p => p.empId === me.id && !p.out)
  const today = HH.dateKey(now)
  const myShifts = HH.getShifts().filter(s => s.empId === me.id && s.date === today)
  const recent = punches.filter(p => p.empId === me.id && p.out).slice(-5).reverse()

  $('#divClock').innerHTML = `
    <h1 id="hClock">Time clock</h1>
    <p style="font-size:1.3rem"><strong>${HH.escapeHtml(me.name)}</strong>: ${open ? `clocked in since ${HH.timeLabel(open.in)}` : 'not clocked in'}</p>
    <button type="button" class="btn ${open ? 'btn-primary' : 'btn-green'} btn-lg btn-block" id="btnPunch">${open ? 'Clock out' : 'Clock in'}</button>
    <h3 style="margin-top:1.5rem">Your shift today</h3>
    ${myShifts.length ? myShifts.map(s => `<p><strong>${HH.clock24to12(s.start)} to ${HH.clock24to12(s.end)}</strong>, ${s.position}<br><span class="lede">${HH.escapeHtml(s.desc)}</span></p>`).join('') : '<p class="empty">You are not scheduled today.</p>'}
    ${recent.length ? `<h3>Your recent punches</h3><ul>${recent.map(p => `<li>${new Date(p.in).toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${HH.timeLabel(p.in)} to ${HH.timeLabel(p.out)} (${(minsBetween(p.in, p.out) / 60).toFixed(2)} hours)</li>`).join('')}</ul>` : ''}`

  $('#btnPunch').addEventListener('click', () => {
    const list = HH.getPunches()
    const mine = list.find(p => p.empId === me.id && !p.out)
    if (mine) mine.out = Date.now()
    else list.push({ id: HH.uid(), empId: me.id, in: Date.now(), out: null })
    HH.savePunches(list)
    swal.fire({ toast: true, position: 'top', icon: 'success', title: mine ? 'Clocked out' : 'Clocked in', showConfirmButton: false, timer: 2000 })
  })

  // Who should be here now, and who is clocked in
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
  const scheduledNow = HH.getShifts().filter(s => s.date === today && HH.toMinutes(s.start) <= nowMins && nowMins < HH.toMinutes(s.end))
  const openPunches = punches.filter(p => !p.out)
  const ids = [...new Set([...scheduledNow.map(s => s.empId), ...openPunches.map(p => p.empId)])]
  $('#divOnClock').innerHTML = ids.length ? `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Position</th><th>Scheduled</th><th>Status</th></tr></thead>
    <tbody>${ids.map(id => {
      const e = HH.findEmployee(id)
      const s = scheduledNow.find(x => x.empId === id)
      const p = openPunches.find(x => x.empId === id)
      return `<tr><td>${HH.escapeHtml(e ? e.name : id)}</td><td>${s ? s.position : ''}</td>
        <td>${s ? HH.clock24to12(s.start) + ' to ' + HH.clock24to12(s.end) : 'Not scheduled'}</td>
        <td>${p ? `<span class="tag ok">In since ${HH.timeLabel(p.in)}</span>` : '<span class="tag low">Not clocked in</span>'}</td></tr>`
    }).join('')}</tbody></table></div>` : '<p class="empty">Nobody is scheduled right now.</p>'
}

// ================= Schedule =================
function weekStart () {
  const d = HH.startOfDay(new Date())
  return HH.addDays(d, -((d.getDay() + 6) % 7) + weekOffset * 7) // weeks start Monday
}
function renderSchedule () {
  const start = weekStart()
  const days = Array.from({ length: 7 }, (_, i) => HH.addDays(start, i))
  const keys = days.map(HH.dateKey)
  const shifts = HH.getShifts().filter(s => keys.includes(s.date))
  const employees = HH.getEmployees()
  const empName = id => (employees.find(e => e.id === id) || {}).name || 'Unknown'
  const wage = id => (employees.find(e => e.id === id) || {}).wage || 0
  const totalHours = shifts.reduce((s, x) => s + HH.shiftHours(x), 0)
  const labor = shifts.reduce((s, x) => s + HH.shiftHours(x) * wage(x.empId), 0)
  const myHours = shifts.filter(s => s.empId === me.id).reduce((s, x) => s + HH.shiftHours(x), 0)
  const fmtDay = d => d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })

  $('#divWeekSummary').innerHTML = `<div class="kpis">
    <div class="stat"><div class="stat-value">${fmtDay(days[0]).split(',')[1]} to ${fmtDay(days[6]).split(',')[1]}</div><div class="stat-label">Week</div></div>
    <div class="stat"><div class="stat-value">${myHours.toFixed(1)}</div><div class="stat-label">Your hours this week</div></div>
    ${isManager() ? `<div class="stat"><div class="stat-value">${totalHours.toFixed(0)}</div><div class="stat-label">Total staff hours</div></div>
    <div class="stat"><div class="stat-value">${HH.money(labor)}</div><div class="stat-label">Estimated hourly labor</div></div>` : ''}
  </div>`

  if (isManager()) {
    $('#divAddShift').innerHTML = `
      <h2>Add a shift</h2>
      <div class="field-row two">
        <div class="field"><label for="selShiftEmp">Employee</label><select id="selShiftEmp">${employees.map(e => `<option value="${e.id}">${HH.escapeHtml(e.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="txtShiftDate">Date</label><input type="date" id="txtShiftDate" value="${keys[0]}"></div>
        <div class="field"><label for="txtShiftStart">Clock in</label><input type="time" id="txtShiftStart" value="16:00"></div>
        <div class="field"><label for="txtShiftEnd">Expected clock out</label><input type="time" id="txtShiftEnd" value="23:30"></div>
        <div class="field"><label for="selShiftPos">Position</label><select id="selShiftPos"><option>Front counter</option><option>Prep / cook</option><option>Floater</option></select></div>
        <div class="field"><label for="txtShiftDesc">Description</label><input type="text" id="txtShiftDesc" placeholder="Closing: portion dough, clean oven"></div>
      </div>
      <button type="button" class="btn btn-green" id="btnAddShift">Add shift</button>`
    $('#btnAddShift').addEventListener('click', () => {
      const s = {
        id: HH.uid(),
        empId: $('#selShiftEmp').value,
        date: $('#txtShiftDate').value,
        start: $('#txtShiftStart').value,
        end: $('#txtShiftEnd').value,
        position: $('#selShiftPos').value,
        desc: $('#txtShiftDesc').value.trim()
      }
      if (!s.date || !s.start || !s.end) {
        swal.fire({ icon: 'error', title: 'Missing details', text: 'Pick a date, clock-in time, and clock-out time.' })
        return
      }
      const list = HH.getShifts()
      list.push(s)
      HH.saveShifts(list)
    })
  }

  $('#divSchedule').innerHTML = days.map((d, i) => {
    const dayShifts = shifts.filter(s => s.date === keys[i]).sort((a, b) => a.start.localeCompare(b.start) || a.position.localeCompare(b.position))
    return `<div class="panel">
      <h2 style="font-size:1.6rem">${fmtDay(d)}${keys[i] === HH.dateKey(new Date()) ? ' <span class="tag ok">Today</span>' : ''}</h2>
      ${dayShifts.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Position</th><th>Clock in</th><th>Expected clock out</th><th class="num">Hours</th><th>Description</th>${isManager() ? '<th><span class="sr-only">Actions</span></th>' : ''}</tr></thead>
        <tbody>${dayShifts.map(s => `<tr class="${s.empId === me.id ? 'mine' : ''}">
          <td>${HH.escapeHtml(empName(s.empId))}</td><td>${s.position}</td>
          <td>${HH.clock24to12(s.start)}</td><td>${HH.clock24to12(s.end)}</td>
          <td class="num">${HH.shiftHours(s).toFixed(1)}</td><td>${HH.escapeHtml(s.desc)}</td>
          ${isManager() ? `<td><button type="button" class="btn btn-link btn-small" data-del-shift="${s.id}">Remove</button></td>` : ''}
        </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No shifts scheduled.</p>'}
    </div>`
  }).join('')
}
$('#btnWeekPrev').addEventListener('click', () => { weekOffset--; renderSchedule() })
$('#btnWeekThis').addEventListener('click', () => { weekOffset = 0; renderSchedule() })
$('#btnWeekNext').addEventListener('click', () => { weekOffset++; renderSchedule() })
$('#divSchedule').addEventListener('click', e => {
  const b = e.target.closest('[data-del-shift]')
  if (!b || !isManager()) return
  HH.saveShifts(HH.getShifts().filter(s => s.id !== b.dataset.delShift))
})

// ================= Inventory =================
function renderInventory () {
  const inv = HH.getInventory()
  const low = inv.filter(i => i.stock <= i.reorder)
  $('#divLowStock').innerHTML = low.length
    ? `<div class="callout bad"><strong>Reorder soon:</strong> ${low.map(i => `${i.name} (${Math.max(0, i.stock)} ${i.unit} left)`).join(', ')}</div>`
    : '<div class="callout">Everything is stocked above its reorder level.</div>'

  const groups = [...new Set(inv.map(i => i.group))]
  $('#divInventory').innerHTML = `<table>
    <thead><tr><th>Item</th><th class="num">On hand</th><th class="num">Reorder at</th><th class="num">Cost per unit</th><th>Status</th><th>Receive delivery</th></tr></thead>
    <tbody>${groups.map(g => `<tr><th colspan="6">${g}</th></tr>` + inv.filter(i => i.group === g).map(i => `
      <tr>
        <td>${i.name}</td>
        <td class="num">${Math.max(0, i.stock)} ${i.unit}</td>
        <td class="num">${i.reorder} ${i.unit}</td>
        <td class="num">${isManager()
          ? `<label class="sr-only" for="cost-${i.id}">Cost per ${i.unit} for ${i.name}</label><input type="number" id="cost-${i.id}" data-cost="${i.id}" value="${i.cost.toFixed(2)}" min="0" step="0.01" style="width:7rem; min-height:44px">`
          : HH.money(i.cost)}</td>
        <td>${i.stock <= i.reorder ? '<span class="tag low">Low</span>' : '<span class="tag ok">OK</span>'}</td>
        <td style="white-space:nowrap">
          <label class="sr-only" for="recv-${i.id}">Amount of ${i.name} received, in ${i.unit}</label>
          <input type="number" id="recv-${i.id}" min="0" step="any" placeholder="${i.unit}" style="width:6.5rem; min-height:44px">
          <button type="button" class="btn btn-secondary btn-small" data-receive="${i.id}">Add</button>
        </td>
      </tr>`).join('')).join('')}</tbody></table>`
  renderMargins()
}
$('#divInventory').addEventListener('click', e => {
  const b = e.target.closest('[data-receive]')
  if (!b) return
  const amount = Number($('#recv-' + b.dataset.receive).value)
  if (!(amount > 0)) {
    swal.fire({ icon: 'error', title: 'Enter an amount', text: 'Type how much came in, then press Add.' })
    return
  }
  const inv = HH.getInventory()
  const row = inv.find(i => i.id === b.dataset.receive)
  row.stock = HH.round2(Math.max(0, row.stock) + amount)
  HH.saveInventory(inv)
  swal.fire({ toast: true, position: 'top', icon: 'success', title: `Added ${amount} ${row.unit} of ${row.name}`, showConfirmButton: false, timer: 2200 })
})
$('#divInventory').addEventListener('change', e => {
  const input = e.target.closest('[data-cost]')
  if (!input || !isManager()) return
  const inv = HH.getInventory()
  const row = inv.find(i => i.id === input.dataset.cost)
  row.cost = Math.max(0, Number(input.value) || 0)
  HH.saveInventory(inv)
})

function renderMargins () {
  const costs = HH.costMap()
  const pct = (cost, price) => Math.round(cost / price * 100) + '%'
  const cheese = C.sizes.map(s => {
    const item = HH.makePizza(s.id, [], 1)
    const cost = HH.itemCost(item, 'pickup', costs)
    return `<tr><td>${s.name} ${s.inches}″ cheese pizza</td><td class="num">${HH.money(s.price)}</td><td class="num">${HH.money(cost)}</td><td class="num">${HH.money(s.price - cost)}</td><td class="num">${pct(cost, s.price)}</td></tr>`
  }).join('')
  const tops = C.toppings.map(t => `<tr><td>${t.name}</td>${C.sizes.map(s => {
    const cost = s.cups * (costs[t.id] || 0)
    return `<td class="num">${HH.money(cost)} of ${HH.money(s.toppingPrice)}</td>`
  }).join('')}</tr>`).join('')
  const drinks = C.drinkSizes.map(d => {
    const cost = costs['cup' + d.id] || 0
    return `<tr><td>${d.name} drink</td><td class="num">${HH.money(d.price)}</td><td class="num">${HH.money(cost)}</td><td class="num">${HH.money(d.price - cost)}</td><td class="num">${pct(cost, d.price)}</td></tr>`
  }).join('')
  $('#divMargins').innerHTML = `
    <table><thead><tr><th>Item</th><th class="num">We charge</th><th class="num">Ingredients cost</th><th class="num">Left over</th><th class="num">Food cost</th></tr></thead>
    <tbody>${cheese}${drinks}</tbody></table>
    <h3 style="margin-top:1.25rem">Toppings: what one topping costs us, out of what we charge</h3>
    <table><thead><tr><th>Topping</th>${C.sizes.map(s => `<th class="num">${s.name} (${cupLabel(s.cups)})</th>`).join('')}</tr></thead><tbody>${tops}</tbody></table>`
}

// ================= Recipes =================
function renderRecipes () {
  const L = C.dough.L
  const batch = 20 // large dough balls per batch
  const flour = HH.round2(L.flour * batch)
  $('#divRecipes').innerHTML = `
    <div class="callout warn no-print"><strong>Placeholder recipes.</strong> These are starting points so the system works. Replace them with Luigi's real recipes in <code>js/staff.js</code>, and update the dough amounts in <code>js/data.js</code> so inventory stays accurate.</div>
    <button type="button" class="btn btn-secondary no-print" onclick="window.print()" style="margin-bottom:1rem">Print recipes</button>

    <div class="panel">
      <h2>Build guide by size</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Step</th>${C.sizes.map(s => `<th>${s.name} ${s.inches}″</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td>Dough ball (flour weight)</td>${C.sizes.map(s => `<td>${C.dough[s.id].flour} lb flour</td>`).join('')}</tr>
          <tr><td>Sauce</td>${C.sizes.map(s => `<td>${cupLabel(s.cups)}</td>`).join('')}</tr>
          <tr><td>Mozzarella</td>${C.sizes.map(s => `<td>${cupLabel(s.cups)}</td>`).join('')}</tr>
          <tr><td>Each topping</td>${C.sizes.map(s => `<td>${cupLabel(s.cups)}</td>`).join('')}</tr>
          <tr><td>Bake</td>${C.sizes.map(() => `<td>${C.oven.cookMinutes} minutes</td>`).join('')}</tr>
          <tr><td>Pickup box</td>${C.sizes.map(s => `<td>${s.inches} inch box</td>`).join('')}</tr>
        </tbody>
      </table></div>
      <ol style="margin-top:1rem">
        <li>Stretch the dough ball by hand to full size. Leave a thin edge for the crust.</li>
        <li>Spread the sauce in a spiral from the center, stopping at the edge.</li>
        <li>Spread the cheese edge to edge.</li>
        <li>Add each topping evenly. Meats go on top so they crisp.</li>
        <li>Bake ${C.oven.cookMinutes} minutes, until the bottom is spotted brown. The oven holds ${C.oven.capacity} large pizzas at a time.</li>
        <li>Cut, box for pickup or plate for dine in, then bump the ticket to Ready.</li>
      </ol>
    </div>

    <div class="report-grid">
      <div class="panel">
        <h2>House dough</h2>
        <p class="lede">Makes about ${batch} large dough balls. Make the day before.</p>
        <ul>
          <li>${flour} lb bread flour</li>
          <li>${HH.round2(flour * 0.62)} lb cool water (about ${Math.round(flour * 0.62 / 8.34 * 10) / 10} gallons)</li>
          <li>${HH.round2(L.salt * batch)} oz salt</li>
          <li>${HH.round2(L.yeast * batch)} oz yeast</li>
          <li>${HH.round2(L.oil * batch)} fl oz olive oil</li>
        </ul>
        <ol>
          <li>Mix flour and yeast. Add water and mix until no dry flour is left.</li>
          <li>Rest 15 minutes, then add salt and oil. Mix until smooth.</li>
          <li>Cover and rest 1 hour.</li>
          <li>Divide into balls by size (see build guide), oil lightly, and refrigerate 24 to 48 hours.</li>
          <li>Take out 1 to 2 hours before stretching.</li>
        </ol>
      </div>
      <div class="panel">
        <h2>House tomato sauce</h2>
        <p class="lede">Makes about 12 cups. Keeps 5 days in the fridge.</p>
        <ul>
          <li>12 cups crushed tomatoes</li>
          <li>1 tablespoon salt</li>
          <li>1 tablespoon dried oregano</li>
          <li>2 tablespoons fresh basil, torn</li>
          <li>4 cloves garlic, grated</li>
          <li>2 tablespoons olive oil</li>
        </ul>
        <ol>
          <li>Stir everything together. Do not cook it; it cooks on the pizza.</li>
          <li>Rest at least 1 hour so the flavors blend.</li>
          <li>Label with the date and refrigerate.</li>
        </ol>
      </div>
    </div>`
}

// ================= Reports =================
function hourOverlap (startMins, endMins, hour) {
  return Math.max(0, Math.min(endMins, (hour + 1) * 60) - Math.max(startMins, hour * 60)) / 60
}

function reportData (days) {
  const end = HH.startOfDay(new Date())
  const start = HH.addDays(end, -days)
  const costs = HH.costMap()
  const employees = HH.getEmployees()
  const wage = id => (employees.find(e => e.id === id) || {}).wage || 0
  const orders = HH.getOrders().filter(o => o.status === 'done' && o.placedAt >= start.getTime() && o.placedAt < end.getTime())

  const dayKeys = Array.from({ length: days }, (_, i) => HH.dateKey(HH.addDays(start, i)))
  const daily = {}
  dayKeys.forEach(k => { daily[k] = { sales: 0, food: 0, labor: 0, orders: 0 } })
  const hourly = Array.from({ length: 24 }, () => ({ sales: 0, food: 0, labor: 0, orders: 0 }))
  const weekday = Array.from({ length: 7 }, () => ({ orders: 0, days: 0, profit: 0 }))
  const toppingCounts = {}
  let ticketMins = 0
  let ticketCount = 0

  orders.forEach(o => {
    const k = HH.dateKey(o.placedAt)
    const sales = o.subtotal - o.discount
    const food = HH.orderFoodCost(o, costs)
    const h = new Date(o.placedAt).getHours()
    daily[k].sales += sales; daily[k].food += food; daily[k].orders++
    hourly[h].sales += sales; hourly[h].food += food; hourly[h].orders++
    o.items.forEach(i => { if (i.kind === 'pizza') i.toppings.forEach(t => { toppingCounts[t] = (toppingCounts[t] || 0) + i.qty }) })
    if (o.t.ready && !o.pickupAt) { ticketMins += minsBetween(o.t.received, o.t.ready); ticketCount++ }
  })

  HH.getShifts().filter(s => daily[s.date]).forEach(s => {
    const w = wage(s.empId)
    daily[s.date].labor += HH.shiftHours(s) * w
    const sm = HH.toMinutes(s.start)
    let em = HH.toMinutes(s.end)
    if (em < sm) em += 24 * 60
    for (let h = 0; h < 24; h++) hourly[h].labor += hourOverlap(sm, em, h) * w
  })

  dayKeys.forEach(k => {
    const d = daily[k]
    d.profit = d.sales - d.food - d.labor
    const dow = new Date(k + 'T12:00:00').getDay()
    weekday[dow].orders += d.orders; weekday[dow].days++; weekday[dow].profit += d.profit
  })
  hourly.forEach(h => { h.profit = (h.sales - h.food - h.labor) / days })

  const sum = f => dayKeys.reduce((s, k) => s + daily[k][f], 0)
  return {
    days, dayKeys, daily, hourly, weekday, toppingCounts,
    sales: sum('sales'), food: sum('food'), labor: sum('labor'), orders: orders.length,
    avgTicket: ticketCount ? ticketMins / ticketCount : 0
  }
}

function makeChart (id, config) {
  if (charts[id]) charts[id].destroy()
  charts[id] = new Chart(document.getElementById(id), config)
}

function renderReports () {
  if (typeof Chart === 'undefined') {
    $('#divKpis').innerHTML = '<div class="callout warn">Charts need an internet connection to load the free Chart.js library.</div>'
    return
  }
  Chart.defaults.font.family = "'Atkinson Hyperlegible', Verdana, sans-serif"
  Chart.defaults.font.size = 14
  Chart.defaults.color = '#1A2129'
  Chart.defaults.maintainAspectRatio = false

  const r = reportData(Number($('#selRange').value))
  const profit = r.sales - r.food - r.labor
  const pct = n => r.sales ? Math.round(n / r.sales * 100) + '% of sales' : ''
  $('#divKpis').innerHTML = `
    <div class="stat"><div class="stat-value">${HH.money(r.sales)}</div><div class="stat-label">Sales (before tax)</div></div>
    <div class="stat"><div class="stat-value">${HH.money(r.food)}</div><div class="stat-label">Ingredients, ${pct(r.food)}</div></div>
    <div class="stat"><div class="stat-value">${HH.money(r.labor)}</div><div class="stat-label">Hourly labor, ${pct(r.labor)}</div></div>
    <div class="stat"><div class="stat-value kpi-value ${profit < 0 ? 'loss' : 'gain'}">${HH.money(profit)}</div><div class="stat-label">Profit after food and labor</div></div>
    <div class="stat"><div class="stat-value">${r.orders}</div><div class="stat-label">Orders, ${HH.money(r.orders ? r.sales / r.orders : 0)} average</div></div>
    <div class="stat"><div class="stat-value">${r.avgTicket.toFixed(1)} min</div><div class="stat-label">Order to ready, average</div></div>`

  // Plain-language notes on where money is made and lost
  const openHours = []
  for (let h = 9; h <= 23; h++) openHours.push(h)
  const losingHours = openHours.filter(h => r.hourly[h].profit < -1)
  const lossTotal = losingHours.reduce((s, h) => s + r.hourly[h].profit, 0)
  const bestHour = openHours.reduce((a, b) => r.hourly[b].profit > r.hourly[a].profit ? b : a)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const losingDays = r.weekday.map((w, i) => ({ i, avg: w.days ? w.profit / w.days : 0 })).filter(d => d.avg < 0)
  $('#divMoneyNotes').innerHTML = `
    <div class="callout"><strong>Best hour:</strong> ${HH.hourLabel(bestHour)} to ${HH.hourLabel(bestHour + 1)} makes about ${HH.money(r.hourly[bestHour].profit)} a day after food and labor.</div>
    ${losingHours.length ? `<div class="callout bad"><strong>Losing money:</strong> ${losingHours.map(h => HH.hourLabel(h)).join(', ')}. Together these hours lose about ${HH.money(-lossTotal)} a day. A specials deal or lighter staffing in these hours would help.</div>` : ''}
    ${losingDays.length ? `<div class="callout warn"><strong>Slow days:</strong> ${losingDays.map(d => `${dayNames[d.i]}s lose about ${HH.money(-d.avg)}`).join('. ')} on average.</div>` : ''}`

  const fmtDate = k => new Date(k + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })
  makeChart('chartDaily', {
    type: 'bar',
    data: {
      labels: r.dayKeys.map(fmtDate),
      datasets: [
        { label: 'Sales', data: r.dayKeys.map(k => HH.round2(r.daily[k].sales)), backgroundColor: '#1E5B3B', order: 2 },
        { label: 'Food + labor', data: r.dayKeys.map(k => HH.round2(r.daily[k].food + r.daily[k].labor)), backgroundColor: '#9AA5AD', order: 2 },
        { label: 'Profit', type: 'line', data: r.dayKeys.map(k => HH.round2(r.daily[k].profit)), borderColor: '#B3121F', backgroundColor: '#B3121F', borderWidth: 3, pointRadius: 3, order: 1 }
      ]
    },
    options: { scales: { y: { ticks: { callback: v => '$' + v } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${HH.money(c.parsed.y)}` } } } }
  })

  makeChart('chartHourly', {
    type: 'bar',
    data: {
      labels: openHours.map(h => HH.hourLabel(h)),
      datasets: [{ label: 'Average profit per day', data: openHours.map(h => HH.round2(r.hourly[h].profit)), backgroundColor: openHours.map(h => r.hourly[h].profit < 0 ? '#B3121F' : '#1E5B3B') }]
    },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => (c.parsed.y < 0 ? 'Loses ' : 'Makes ') + HH.money(Math.abs(c.parsed.y)) + ' a day' } } }, scales: { y: { ticks: { callback: v => '$' + v } } } }
  })

  const order = [1, 2, 3, 4, 5, 6, 0]
  makeChart('chartWeekday', {
    type: 'bar',
    data: {
      labels: order.map(i => dayNames[i].slice(0, 3)),
      datasets: [{ label: 'Average orders', data: order.map(i => r.weekday[i].days ? Math.round(r.weekday[i].orders / r.weekday[i].days) : 0), backgroundColor: '#1E5B3B' }]
    },
    options: { plugins: { legend: { display: false } } }
  })

  const tops = Object.entries(r.toppingCounts).sort((a, b) => b[1] - a[1])
  makeChart('chartToppings', {
    type: 'bar',
    data: { labels: tops.map(([id]) => HH.topping(id).name), datasets: [{ label: 'Times ordered', data: tops.map(([, n]) => n), backgroundColor: '#B3121F' }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } } }
  })

  renderForecast()
  $('#chkAlwaysOpen').checked = HH.getSettings().alwaysOpen
}

function renderForecast () {
  const today = HH.startOfDay(new Date())
  const counts = {}
  let pizzaTotal = 0
  let orderTotal = 0
  HH.getOrders().forEach(o => {
    if (o.placedAt >= today.getTime() || o.placedAt < HH.addDays(today, -28).getTime()) return
    const key = HH.dateKey(o.placedAt) + '|' + new Date(o.placedAt).getHours()
    counts[key] = (counts[key] || 0) + 1
    pizzaTotal += HH.countPizzas(o.items)
    orderTotal++
  })
  const pizzasPerOrder = orderTotal ? pizzaTotal / orderTotal : 1.5
  const hours = []
  for (let h = C.openHour; h < C.closeHour; h++) hours.push(h)
  const weights = [4, 3, 2, 1]

  const rows = Array.from({ length: 7 }, (_, d) => {
    const day = HH.addDays(today, d)
    return {
      day,
      values: hours.map(h => {
        let sum = 0
        let wsum = 0
        weights.forEach((w, i) => {
          sum += w * (counts[HH.dateKey(HH.addDays(day, -7 * (i + 1))) + '|' + h] || 0)
          wsum += w
        })
        return sum / wsum
      })
    }
  })
  const max = Math.max(1, ...rows.flatMap(r => r.values))
  const level = v => v < 0.5 ? 0 : v / max < 0.25 ? 1 : v / max < 0.5 ? 2 : v / max < 0.75 ? 3 : 4

  $('#divForecast').innerHTML = `<table class="heat">
    <thead><tr><th scope="col">Day</th>${hours.map(h => `<th scope="col">${HH.hourLabel(h).replace(' ', '')}</th>`).join('')}<th scope="col">Total</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><th scope="row">${i === 0 ? 'Today' : r.day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</th>
      ${r.values.map(v => `<td class="lvl${level(v)}">${Math.round(v)}</td>`).join('')}
      <td><strong>${Math.round(r.values.reduce((a, b) => a + b, 0))}</strong></td></tr>`).join('')}</tbody></table>
    <div class="legend-row"><span>Orders per hour:</span><span class="lvl1">Quiet</span><span class="lvl2">Steady</span><span class="lvl3">Busy</span><span class="lvl4">Rush</span></div>`

  const slots = rows.flatMap(r => r.values.map((v, i) => ({ day: r.day, hour: hours[i], v })))
  const top = [...slots].sort((a, b) => b.v - a.v).slice(0, 5)
  const peakPizzas = Math.round(top[0].v * pizzasPerOrder)
  const ovenPerHour = Math.floor(C.oven.capacity * 60 / C.oven.cookMinutes)
  const rush = slots.filter(s => level(s.v) === 4)
  const rushDays = [...new Set(rush.map(s => s.day.toLocaleDateString([], { weekday: 'long' })))]
  const fmt = s => `${s.day.toLocaleDateString([], { weekday: 'long' })} at ${HH.hourLabel(s.hour)} (about ${Math.round(s.v)} orders)`

  $('#divForecastNotes').innerHTML = `
    <h3 style="margin-top:1.25rem">What this means</h3>
    <ul>
      <li><strong>Busiest times coming up:</strong> ${top.map(fmt).join('; ')}.</li>
      <li><strong>Oven:</strong> it can bake about ${ovenPerHour} pizzas an hour (${C.oven.capacity} at a time, ${C.oven.cookMinutes} minutes each). The busiest hour should need about ${peakPizzas}, so the make line and staff are the limit, not the oven.</li>
      ${rushDays.length ? `<li><strong>Staffing:</strong> plan a full crew, and consider a 5th person, for the rush hours on ${rushDays.join(', ')}.</li>` : ''}
      <li><strong>Room to grow:</strong> quiet hours (the lightest cells) are the best time for a specials deal to bring in more customers.</li>
    </ul>`
}
$('#selRange').addEventListener('change', renderReports)
$('#chkAlwaysOpen').addEventListener('change', e => HH.saveSettings({ ...HH.getSettings(), alwaysOpen: e.target.checked }))
$('#btnResetDemo').addEventListener('click', async () => {
  const answer = await swal.fire({ icon: 'warning', title: 'Reset all demo data?', text: 'This replaces every order, customer, shift, and inventory count with fresh sample data.', showCancelButton: true, confirmButtonText: 'Reset' })
  if (!answer.isConfirmed) return
  HH.resetDemo()
  lastBump = null
  startSession()
})

// ================= Live updates =================
HH.onChange(key => {
  if (!me) return
  if (key === 'employees') { startSession(); return }
  if (currentView === 'kitchen' && ['orders', '*'].includes(key)) renderKitchen()
  else if (currentView === 'clock' && ['punches', 'shifts', '*'].includes(key)) renderClock()
  else if (currentView === 'schedule' && ['shifts', '*'].includes(key)) renderSchedule()
  else if (currentView === 'inventory' && ['inventory', 'orders', '*'].includes(key)) renderInventory()
})
setInterval(() => { if (me && currentView === 'kitchen') tickTimers() }, 1000)
setInterval(() => { if (me && currentView === 'kitchen') renderKitchen() }, 30000) // moves scheduled orders up on time

// ================= Start =================
renderPinPad()
if (sessionStorage.getItem(SESSION_KEY)) startSession()
else $('#txtPin').focus()
