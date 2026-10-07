/* =========================================================
   Hungry Hippo Pizzas: customer site
   Order (build pizzas, add drinks, check out), Track (live
   completion meter), and Rewards (sign in, points, reorder).
   ========================================================= */

HH.seedIfNeeded()

const $ = sel => document.querySelector(sel)
const $$ = sel => Array.from(document.querySelectorAll(sel))
const C = HH.CONFIG

const state = {
  size: 'L',
  toppings: new Set(),
  qty: 1,
  drink: 'coke',
  drinkSize: 'M',
  cart: HH.load('cart', []),
  redeem: false,
  trackId: null
}

const swal = HH.makeDialog()

function announce (text) {
  $('#divAnnounce').textContent = ''
  setTimeout(() => { $('#divAnnounce').textContent = text }, 50)
}

// ---------- Text size ----------
function applyTextSize (cls) {
  document.documentElement.classList.remove('text-lg', 'text-xl')
  if (cls) document.documentElement.classList.add(cls)
  $$('.ts-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === cls)))
  HH.save('text_size', cls)
}
$$('.ts-btn').forEach(b => b.addEventListener('click', () => applyTextSize(b.dataset.size)))
applyTextSize(HH.load('text_size', ''))

// ---------- Views: Home, Order, Track, Rewards ----------
// The view is kept in the address (#order, #track...) so the browser's
// Back button works the way people expect.
const VIEWS = ['home', 'order', 'track', 'rewards']
let currentView = 'home'
let pendingScroll = null

function viewFromHash () {
  const v = location.hash.slice(1)
  return VIEWS.includes(v) ? v : 'home'
}
function showView (name, focus = true) {
  currentView = name
  VIEWS.forEach(v => { $('#view' + v[0].toUpperCase() + v.slice(1)).hidden = v !== name })
  $$('.nav-link').forEach(l => {
    if (l.dataset.view === name && !l.dataset.scroll) l.setAttribute('aria-current', 'page')
    else l.removeAttribute('aria-current')
  })
  if (name === 'track') renderTrack()
  if (name === 'rewards') renderRewards()
  renderCartBar()
  if (focus) {
    window.scrollTo(0, 0)
    $('#main').focus({ preventScroll: true })
  }
}
function scrollToTarget (sel) {
  const el = sel && $(sel)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const heading = el.matches('h1, h2, h3') ? el : el.querySelector('h1, h2, h3')
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }
}
function go (name, scrollTo) {
  if (location.hash !== '#' + name) {
    pendingScroll = scrollTo
    location.hash = name
  } else {
    showView(name, !scrollTo)
    scrollToTarget(scrollTo)
  }
}
window.addEventListener('hashchange', () => {
  showView(viewFromHash(), !pendingScroll)
  scrollToTarget(pendingScroll)
  pendingScroll = null
})

// One click handler for every "go somewhere" button on the page
document.addEventListener('click', e => {
  const start = e.target.closest('[data-start]')
  if (start) { setType(start.dataset.start); go('order', '#hStep1'); return }
  const pickSize = e.target.closest('[data-pick-size]')
  if (pickSize) {
    state.size = pickSize.dataset.pickSize
    renderSizes(); renderToppings(); renderBuilderPrice()
    go('order', '#hStep2')
    return
  }
  const link = e.target.closest('[data-view]')
  if (link) go(link.dataset.view, link.dataset.scroll)
})
$('#btnHeaderCart').addEventListener('click', () => go('order', '#secCart'))
$('#btnHeaderSignIn').addEventListener('click', () => go('rewards'))

// ---------- Hours ----------
function renderHours () {
  const open = HH.isOpen()
  const demo = !open && HH.getSettings().alwaysOpen
  $('#divHours').innerHTML = `
    <span class="dot ${open ? 'open' : 'closed'}" aria-hidden="true"></span>
    <strong>${open ? 'Open now until 11 PM' : 'Closed now. We open at 10 AM.'}</strong>
    <span class="util-muted">Pickup and dine in, 10 AM to 11 PM every day</span>
    ${demo ? '<span class="tag">Demo: taking orders after hours</span>' : ''}`
}

// ---------- Step 1: pickup or dine in ----------
function getType () {
  return document.querySelector('input[name="radType"]:checked').value
}
function renderWhen () {
  const sel = $('#selWhen')
  const keep = sel.value
  const slots = HH.pickupSlots()
  const today = HH.dateKey(new Date())
  let html = ''
  if (HH.takingAsap()) {
    const mins = HH.estimateMinutes(Math.max(1, HH.countPizzas(state.cart)))
    html += `<option value="asap">As soon as possible, about ${mins} min</option>`
  }
  slots.forEach(ms => {
    const day = HH.dateKey(ms) === today ? 'Today' : 'Tomorrow'
    html += `<option value="${ms}">${day} at ${HH.timeLabel(ms)}</option>`
  })
  sel.innerHTML = html
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep
}
function updateTypeUI () {
  $('#divTable').hidden = getType() !== 'dinein'
  $('label[for="selWhen"]').textContent = getType() === 'dinein' ? 'When will you be here?' : 'When do you want it?'
}
function setType (type) {
  const radio = document.querySelector(`input[name="radType"][value="${type}"]`)
  if (radio) radio.checked = true
  updateTypeUI()
}
$$('input[name="radType"]').forEach(r => r.addEventListener('change', updateTypeUI))

// ---------- Step 2: pizza builder ----------
function renderSizes () {
  $('#divSizes').innerHTML = C.sizes.map(s => `
    <label class="choice size-card">
      <input type="radio" name="radSize" value="${s.id}" ${s.id === state.size ? 'checked' : ''}>
      <span class="choice-body">
        <span class="size-inch">${s.inches}″</span>
        <span class="size-name">${s.name}</span>
        <span class="size-price">${HH.money(s.price)}</span>
      </span>
    </label>`).join('')
  $$('input[name="radSize"]').forEach(r => r.addEventListener('change', () => {
    state.size = r.value
    renderToppings()
    renderBuilderPrice()
  }))
}

function renderToppings () {
  const s = HH.size(state.size)
  $('#lblToppingNote').textContent = `(${HH.money(s.toppingPrice)} each on a ${s.name.toLowerCase()})`
  $('#divToppings').innerHTML = C.toppings.map(t => `
    <button type="button" class="chip" data-topping="${t.id}" aria-pressed="${state.toppings.has(t.id)}">
      <span>${t.name}</span><span class="chip-price">+${HH.money(s.toppingPrice)}</span>
    </button>`).join('')
}
$('#divToppings').addEventListener('click', e => {
  const btn = e.target.closest('[data-topping]')
  if (!btn) return
  const id = btn.dataset.topping
  if (state.toppings.has(id)) state.toppings.delete(id)
  else state.toppings.add(id)
  btn.setAttribute('aria-pressed', String(state.toppings.has(id)))
  renderBuilderPrice()
})

function renderBuilderPrice () {
  const each = HH.pizzaPrice(state.size, [...state.toppings])
  $('#outQty').textContent = state.qty
  $('#btnAddPizza').textContent = `Add ${state.qty > 1 ? state.qty + ' pizzas' : 'pizza'}: ${HH.money(each * state.qty)}`
}
$('#btnQtyMinus').addEventListener('click', () => { state.qty = Math.max(1, state.qty - 1); renderBuilderPrice() })
$('#btnQtyPlus').addEventListener('click', () => { state.qty = Math.min(20, state.qty + 1); renderBuilderPrice() })

$('#btnAddPizza').addEventListener('click', () => {
  const item = HH.makePizza(state.size, [...state.toppings], state.qty)
  addToCart(item)
  state.toppings.clear()
  state.qty = 1
  renderToppings()
  renderBuilderPrice()
})

// ---------- Step 3: drinks ----------
function renderDrinks () {
  $('#divDrinks').innerHTML = C.drinks.map(d => `
    <label class="choice">
      <input type="radio" name="radDrink" value="${d.id}" ${d.id === state.drink ? 'checked' : ''}>
      <span class="choice-body"><span class="choice-title">${d.name}</span></span>
    </label>`).join('')
  $('#divDrinkSizes').innerHTML = C.drinkSizes.map(s => `
    <label class="choice">
      <input type="radio" name="radDrinkSize" value="${s.id}" ${s.id === state.drinkSize ? 'checked' : ''}>
      <span class="choice-body" style="text-align:center"><span class="choice-title">${s.name}</span><span class="choice-note">${HH.money(s.price)}</span></span>
    </label>`).join('')
  $$('input[name="radDrink"]').forEach(r => r.addEventListener('change', () => { state.drink = r.value; renderDrinkButton() }))
  $$('input[name="radDrinkSize"]').forEach(r => r.addEventListener('change', () => { state.drinkSize = r.value; renderDrinkButton() }))
  renderDrinkButton()
}
function renderDrinkButton () {
  $('#btnAddDrink').textContent = `Add ${HH.drinkSize(state.drinkSize).name.toLowerCase()} ${HH.drink(state.drink).name}: ${HH.money(HH.drinkSize(state.drinkSize).price)}`
}
$('#btnAddDrink').addEventListener('click', () => addToCart(HH.makeDrink(state.drink, state.drinkSize, 1)))

// ---------- Cart ----------
function sameItem (a, b) {
  return a.kind === b.kind && a.size === b.size && a.drink === b.drink &&
    JSON.stringify(a.toppings || []) === JSON.stringify(b.toppings || [])
}
function addToCart (item) {
  const match = state.cart.find(i => sameItem(i, item))
  if (match) match.qty = Math.min(20, match.qty + item.qty)
  else state.cart.push(item)
  saveCart()
  const text = `Added ${item.qty > 1 ? item.qty + ' × ' : ''}${HH.itemTitle(item)}${item.kind === 'pizza' ? ' (' + HH.itemDetail(item) + ')' : ''}`
  announce(text + ' to your order.')
  swal.fire({ toast: true, position: 'top', icon: 'success', title: text, showConfirmButton: false, timer: 2200 })
}
function saveCart () {
  HH.save('cart', state.cart)
  renderCart()
}

function renderCart () {
  const list = $('#divCartItems')
  if (state.cart.length === 0) {
    list.innerHTML = '<p class="empty">Nothing here yet. Build a pizza to get started.</p>'
  } else {
    list.innerHTML = '<ul class="cart-list">' + state.cart.map((item, i) => `
      <li class="cart-line">
        <div class="cart-line-top">
          <div>
            <div class="cart-line-title">${HH.itemTitle(item)}</div>
            ${item.kind === 'pizza' ? `<div class="cart-line-detail">${HH.itemDetail(item)}</div>` : ''}
          </div>
          <div><strong>${HH.money(item.unitPrice * item.qty)}</strong></div>
        </div>
        <div class="cart-line-actions">
          <div class="qty small" role="group" aria-label="How many ${HH.itemTitle(item)}">
            <button type="button" data-line="${i}" data-change="-1" aria-label="One fewer">&minus;</button>
            <span class="qty-num">${item.qty}</span>
            <button type="button" data-line="${i}" data-change="1" aria-label="One more">+</button>
          </div>
          <button type="button" class="btn btn-link btn-small" data-remove="${i}">Remove</button>
        </div>
      </li>`).join('') + '</ul>'
  }

  const me = HH.currentCustomer()
  const canRedeem = me && me.points >= C.rewards.redeemPoints && state.cart.length > 0
  if (!canRedeem) state.redeem = false
  $('#divRedeem').innerHTML = canRedeem
    ? `<div class="callout"><label class="check"><input type="checkbox" id="chkRedeem" ${state.redeem ? 'checked' : ''}>
        <span><strong>Use ${C.rewards.redeemPoints} points for ${HH.money(C.rewards.redeemValue)} off</strong><br>You have ${me.points} points.</span></label></div>`
    : ''
  const chk = $('#chkRedeem')
  if (chk) chk.addEventListener('change', () => { state.redeem = chk.checked; renderCart() })

  const t = HH.calcTotals(state.cart, state.redeem)
  $('#dlTotals').innerHTML = `
    <dt>Subtotal</dt><dd>${HH.money(t.subtotal)}</dd>
    ${t.discount ? `<dt class="save">Rewards</dt><dd class="save">&minus;${HH.money(t.discount)}</dd>` : ''}
    <dt>Tax</dt><dd>${HH.money(t.tax)}</dd>
    <dt class="grand">Total</dt><dd class="grand">${HH.money(t.total)}</dd>`

  if (state.cart.length) {
    const mins = HH.estimateMinutes(t.pizzaCount)
    $('#pEstimate').textContent = `Ready in about ${mins} minutes if you order now.${me ? ` You will earn ${t.pointsEarned} points.` : ''}`
  } else {
    $('#pEstimate').textContent = ''
  }
  renderCustomerBox()
  renderCartBar()
}

$('#divCartItems').addEventListener('click', e => {
  const step = e.target.closest('[data-line]')
  const remove = e.target.closest('[data-remove]')
  if (step) {
    const item = state.cart[Number(step.dataset.line)]
    item.qty += Number(step.dataset.change)
    if (item.qty <= 0) state.cart.splice(Number(step.dataset.line), 1)
    item.qty = Math.min(item.qty, 20)
    saveCart()
  } else if (remove) {
    const [item] = state.cart.splice(Number(remove.dataset.remove), 1)
    saveCart()
    announce(`Removed ${HH.itemTitle(item)}.`)
  }
})

function renderCartBar () {
  const count = state.cart.reduce((n, i) => n + i.qty, 0)
  $('#lblCartCount').textContent = count
  $('#btnHeaderCart').setAttribute('aria-label', `Your order, ${count} ${count === 1 ? 'item' : 'items'}`)
  $('#divCartBar').hidden = count === 0 || !['home', 'order'].includes(currentView)
  const t = HH.calcTotals(state.cart, state.redeem)
  $('#btnCartBar').textContent = `Review order (${count} ${count === 1 ? 'item' : 'items'}): ${HH.money(t.total)}`
}
$('#btnCartBar').addEventListener('click', () => go('order', '#secCart'))

function renderCustomerBox () {
  const me = HH.currentCustomer()
  $('#btnHeaderSignIn').textContent = me ? `Hi, ${me.name.split(' ')[0]}` : 'Sign in'
  $('#divGuest').hidden = Boolean(me)
  $('#divSignedIn').innerHTML = me
    ? `<div class="callout"><strong>Ordering as ${HH.escapeHtml(me.name)}</strong><br>${HH.formatPhone(me.phone)}</div>`
    : '<p class="hint" style="margin-bottom:1rem">Have a rewards account? <button type="button" class="btn btn-link btn-small" id="btnGoSignIn">Sign in</button> to earn points.</p>'
  const btnGo = $('#btnGoSignIn')
  if (btnGo) btnGo.addEventListener('click', () => go('rewards'))
}

// ---------- Place order ----------
const regEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

$('#btnPlace').addEventListener('click', () => {
  const me = HH.currentCustomer()
  const type = getType()
  const when = $('#selWhen').value
  const name = me ? me.name : $('#txtName').value.trim()
  const phone = me ? me.phone : $('#txtPhone').value.trim()
  const errors = []

  $$('.is-invalid').forEach(el => el.classList.remove('is-invalid'))
  const fail = (msg, el) => { errors.push(msg); if (el) el.classList.add('is-invalid') }

  if (state.cart.length === 0) fail('Add at least one pizza or drink.')
  if (!when) fail('Choose a time.', $('#selWhen'))
  if (!me) {
    if (name.length < 1) fail('Enter your name.', $('#txtName'))
    if (HH.digits(phone).length !== 10) fail('Enter a 10-digit phone number.', $('#txtPhone'))
  }

  if (errors.length) {
    swal.fire({ icon: 'error', title: 'Almost there', html: '<ul>' + errors.map(e => `<li>${e}</li>`).join('') + '</ul>' })
    return
  }

  const order = HH.placeOrder({
    type,
    table: type === 'dinein' ? $('#txtTable').value.trim() : '',
    pickupAt: when === 'asap' ? null : Number(when),
    name,
    phone,
    email: me ? me.email : '',
    customerId: me ? me.id : null,
    items: state.cart,
    notes: $('#txtNotes').value.trim(),
    payment: document.querySelector('input[name="radPay"]:checked').value,
    redeem: state.redeem
  })

  const mine = HH.load('my_orders', [])
  mine.push(order.id)
  HH.save('my_orders', mine.slice(-20))
  state.cart = []
  state.redeem = false
  $('#txtNotes').value = ''
  saveCart()
  renderWhen()

  state.trackId = order.id
  const whenText = order.pickupAt
    ? `We'll have it ready at <strong>${HH.timeLabel(order.promisedAt)}</strong>.`
    : `Ready at about <strong>${HH.timeLabel(order.promisedAt)}</strong>.`
  swal.fire({
    icon: 'success',
    title: `Order #${order.number} placed`,
    html: `<p>${whenText}</p>
      <p>Total: <strong>${HH.money(order.total)}</strong>. Pay at the counter with ${order.payment.toLowerCase()}.</p>
      ${order.customerId ? `<p>You earned <strong>${order.pointsEarned} points</strong>.</p>` : ''}`,
    confirmButtonText: 'Track my order'
  }).then(() => go('track'))
})

// ---------- Track ----------
function meterPercent (order) {
  const idx = HH.statusIndex(order.status)
  if (idx >= 3) return 100
  if (order.status === 'oven') {
    const done = Math.min(1, (Date.now() - order.t.oven) / (C.oven.cookMinutes * 60000))
    return Math.round(67 + done * 28)
  }
  return [8, 33, 67][idx]
}

function trackHtml (order) {
  const idx = HH.statusIndex(order.status)
  const st = HH.STATUSES[idx]
  const dine = order.type === 'dinein'
  let status = st.customer
  if (order.status === 'ready') status = dine ? 'Ready. Coming to your table.' : 'Ready. Come on in!'
  if (order.status === 'done') status = dine ? 'Served. Enjoy!' : 'Picked up. Enjoy!'
  if (HH.isLater(order)) status = `Scheduled for ${HH.timeLabel(order.pickupAt)}`
  const pct = meterPercent(order)
  const steps = ['Received', 'Being made', 'In the oven', 'Ready']

  return `
    <p class="lede" style="margin:0">Order number</p>
    <div class="track-number">#${order.number}</div>
    <div class="track-status">${status}</div>
    <div class="meter" role="progressbar" aria-label="Order progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${status}">
      <div class="meter-fill" style="width:${pct}%"></div>
    </div>
    <ol class="meter-steps">
      ${steps.map((s, i) => `<li class="${i <= idx ? 'reached' : ''} ${i === Math.min(idx, 3) ? 'current' : ''}">${s}</li>`).join('')}
    </ol>
    ${idx < 3 ? `<p><strong>${order.pickupAt ? 'Ready at' : 'Estimated ready time'}: ${HH.timeLabel(order.promisedAt)}</strong></p>` : ''}
    <p>${dine ? `Dine in${order.table ? ', table ' + HH.escapeHtml(order.table) : ''}` : 'Pickup at the counter'}. Pay with ${order.payment.toLowerCase()}: <strong>${HH.money(order.total)}</strong></p>
    <ul class="item-list">${order.items.map(i => `<li>${i.qty} × ${HH.itemTitle(i)}${i.kind === 'pizza' ? ': ' + HH.itemDetail(i) : ''}</li>`).join('')}</ul>`
}

function renderTrack () {
  const mine = HH.load('my_orders', [])
  const orders = HH.getOrders()
  if (!state.trackId && mine.length) state.trackId = mine[mine.length - 1]
  const order = orders.find(o => o.id === state.trackId)
  const box = $('#divTrack')
  if (!order) {
    box.innerHTML = '<p class="empty">You have no orders on this device yet. Place an order, or find one below.</p>'
    return
  }
  let html = trackHtml(order)
  const others = mine.filter(id => id !== order.id).map(id => orders.find(o => o.id === id)).filter(Boolean).slice(-3).reverse()
  if (others.length) {
    html += '<h3 style="margin-top:1.5rem">Other orders on this device</h3>' + others.map(o =>
      `<button type="button" class="btn btn-secondary btn-small" data-track="${o.id}" style="margin:0 .5rem .5rem 0">#${o.number}, ${HH.STATUSES[HH.statusIndex(o.status)].customer.toLowerCase()}</button>`).join('')
  }
  box.innerHTML = html
}
$('#divTrack').addEventListener('click', e => {
  const b = e.target.closest('[data-track]')
  if (b) { state.trackId = b.dataset.track; renderTrack() }
})
$('#btnFind').addEventListener('click', () => {
  const num = Number(HH.digits($('#txtFindNumber').value))
  const phone = HH.digits($('#txtFindPhone').value)
  const order = HH.getOrders().find(o => o.number === num && o.phone === phone)
  if (!order) {
    swal.fire({ icon: 'error', title: 'No order found', text: 'Check the order number and phone number and try again.' })
    return
  }
  state.trackId = order.id
  renderTrack()
  $('#hTrack').focus()
})

// ---------- Rewards ----------
function renderRewards () {
  const me = HH.currentCustomer()
  const box = $('#divRewards')
  const r = C.rewards
  if (!me) {
    box.innerHTML = `
      <h2>Hungry Hippo Rewards</h2>
      <p>Earn ${r.pointsPerDollar} point for every dollar you spend. Every ${r.redeemPoints} points takes ${HH.money(r.redeemValue)} off an order.</p>
      <h3 style="margin-top:1.25rem">Sign in</h3>
      <div class="field"><label for="txtInPhone">Phone number</label><input type="tel" id="txtInPhone" autocomplete="tel"></div>
      <div class="field"><label for="txtInPin">4-digit PIN</label><input type="password" id="txtInPin" inputmode="numeric" maxlength="4" autocomplete="current-password"></div>
      <button type="button" class="btn btn-green btn-lg btn-block" id="btnSignIn">Sign in</button>
      <p class="hint">Demo account: phone 931-555-0100, PIN 1234.</p>

      <h3 style="margin-top:2rem">New here? Join for free</h3>
      <div class="field"><label for="txtUpName">Your name</label><input type="text" id="txtUpName" autocomplete="name"></div>
      <div class="field"><label for="txtUpPhone">Phone number</label><input type="tel" id="txtUpPhone" autocomplete="tel"></div>
      <div class="field"><label for="txtUpEmail">Email <span class="optional">(optional)</span></label><input type="email" id="txtUpEmail" autocomplete="email"></div>
      <div class="field-row two">
        <div class="field"><label for="txtUpPin">Choose a 4-digit PIN</label><input type="password" id="txtUpPin" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>
        <div class="field"><label for="txtUpPin2">Type the PIN again</label><input type="password" id="txtUpPin2" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>
      </div>
      <button type="button" class="btn btn-secondary btn-lg btn-block" id="btnSignUp">Create account</button>`
    $('#btnSignIn').addEventListener('click', signIn)
    $('#btnSignUp').addEventListener('click', signUp)
    return
  }

  const toNext = r.redeemPoints - (me.points % r.redeemPoints)
  const rewardsReady = Math.floor(me.points / r.redeemPoints)
  const pct = Math.round(((me.points % r.redeemPoints) / r.redeemPoints) * 100)
  const history = HH.getOrders().filter(o => o.customerId === me.id).sort((a, b) => b.placedAt - a.placedAt).slice(0, 5)

  box.innerHTML = `
    <h2>Hi, ${HH.escapeHtml(me.name.split(' ')[0])}</h2>
    <p class="lede" style="margin:0">Your points</p>
    <div class="points-big">${me.points}</div>
    <p>${rewardsReady > 0
      ? `<strong>You have ${rewardsReady} reward${rewardsReady > 1 ? 's' : ''} ready.</strong> Check the box at checkout to use ${HH.money(r.redeemValue)} off.`
      : `${toNext} more points until ${HH.money(r.redeemValue)} off.`}</p>
    <div class="meter" role="progressbar" aria-label="Progress to next reward" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="meter-fill" style="width:${pct}%"></div></div>
    <p class="hint">Earn ${r.pointsPerDollar} point per dollar. ${r.redeemPoints} points = ${HH.money(r.redeemValue)} off.</p>

    <h3 style="margin-top:1.5rem">Your recent orders</h3>
    ${history.length ? history.map(o => `
      <div class="order-card">
        <div class="order-card-top">
          <strong>#${o.number}</strong>
          <span>${new Date(o.placedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${HH.money(o.total)}</span>
        </div>
        <ul class="item-list">${o.items.map(i => `<li>${i.qty} × ${HH.itemTitle(i)}${i.kind === 'pizza' ? ': ' + HH.itemDetail(i) : ''}</li>`).join('')}</ul>
        <button type="button" class="btn btn-secondary btn-small" data-reorder="${o.id}">Order this again</button>
      </div>`).join('') : '<p class="empty">No orders yet.</p>'}
    <button type="button" class="btn btn-link" id="btnSignOut">Sign out</button>`

  $('#btnSignOut').addEventListener('click', () => { HH.setCurrentCustomer(null); renderRewards(); renderCart() })
}

$('#divRewards').addEventListener('click', e => {
  const b = e.target.closest('[data-reorder]')
  if (!b) return
  const order = HH.findOrder(b.dataset.reorder)
  if (!order) return
  order.items.forEach(item => addToCart(HH.repriceItem(item)))
  go('order', '#secCart')
})

function signIn () {
  const c = HH.signInCustomer($('#txtInPhone').value, $('#txtInPin').value)
  if (!c) {
    swal.fire({ icon: 'error', title: 'Could not sign in', text: 'That phone number and PIN do not match. Try again.' })
    return
  }
  HH.setCurrentCustomer(c.id)
  renderRewards()
  renderCart()
  announce(`Signed in as ${c.name}.`)
}

function signUp () {
  const name = $('#txtUpName').value.trim()
  const phone = $('#txtUpPhone').value.trim()
  const email = $('#txtUpEmail').value.trim()
  const pin = $('#txtUpPin').value
  const errors = []
  if (!name) errors.push('Enter your name.')
  if (HH.digits(phone).length !== 10) errors.push('Enter a 10-digit phone number.')
  else if (HH.findCustomerByPhone(phone)) errors.push('That phone number already has an account. Sign in instead.')
  if (email && !regEmail.test(email)) errors.push('Check your email address, or leave it blank.')
  if (!/^\d{4}$/.test(pin)) errors.push('Your PIN must be 4 numbers.')
  else if (pin !== $('#txtUpPin2').value) errors.push('The two PINs do not match.')
  if (errors.length) {
    swal.fire({ icon: 'error', title: 'Almost there', html: '<ul>' + errors.map(e => `<li>${e}</li>`).join('') + '</ul>' })
    return
  }
  const c = HH.createCustomer({ name, phone, email, pin })
  HH.setCurrentCustomer(c.id)
  renderRewards()
  renderCart()
  swal.fire({ icon: 'success', title: 'Welcome!', text: 'You will earn points on every order.' })
}

// ---------- Keep everything live ----------
HH.onChange(key => {
  if (key === 'orders' || key === '*') {
    if (!$('#viewTrack').hidden) renderTrack()
    renderWhen()
  }
  if (key === 'customers' || key === 'session_customer' || key === '*') {
    renderCart()
    if (!$('#viewRewards').hidden) renderRewards()
  }
  if (key === 'settings') { renderHours(); renderWhen() }
})
setInterval(() => {
  renderHours()
  if (!$('#viewTrack').hidden) renderTrack()
}, 15000)

// ---------- Start ----------
renderHours()
renderWhen()
renderSizes()
renderToppings()
renderBuilderPrice()
renderDrinks()
renderCart()
showView(viewFromHash(), false)
