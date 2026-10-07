/* =========================================================
   Hungry Hippo Pizzas: shared data and business rules
   Used by index.html (customers) and staff.html (workers).

   DEMO STORAGE: everything is saved in this browser with
   localStorage, which is free and built in. Open the
   customer site and the staff site in two tabs of the same
   browser and they stay in sync.

   To go live on many phones and devices, replace the
   "Storage" section below with a free-tier database
   (see README.md). Nothing else has to change.
   ========================================================= */

const HH = (function () {
  'use strict'

  // ---------- Business settings (edit these) ----------
  const CONFIG = {
    shopName: 'Hungry Hippo Pizzas',
    openHour: 10, // 10 AM
    closeHour: 23, // 11 PM, every day
    taxRate: 0.0975, // Cookeville / Putnam County, TN. Confirm before going live.
    prepMinutes: 4, // ASSUMPTION: time to stretch and top one pizza
    oven: { capacity: 12, cookMinutes: 8 },

    // Price, topping price and portion (cups of sauce, cheese, and each topping) by size
    sizes: [
      { id: 'S', name: 'Small', inches: 12, price: 5, toppingPrice: 1, cups: 0.25 },
      { id: 'M', name: 'Medium', inches: 14, price: 7, toppingPrice: 2, cups: 0.5 },
      { id: 'L', name: 'Large', inches: 18, price: 9, toppingPrice: 3, cups: 1 }
    ],
    crust: { name: 'New York style', note: 'Hand-stretched dough made fresh in house every day' },
    toppings: [
      { id: 'pepperoni', name: 'Pepperoni' },
      { id: 'sausage', name: 'Sausage' },
      { id: 'beef', name: 'Beef' },
      { id: 'greenpepper', name: 'Green peppers' },
      { id: 'jalapeno', name: 'Jalapeños' },
      { id: 'pineapple', name: 'Pineapple' },
      { id: 'onion', name: 'Onion' },
      { id: 'olive', name: 'Black olives' },
      { id: 'tomato', name: 'Diced tomatoes' }
    ],
    drinks: [
      { id: 'tea', name: 'Iced tea' },
      { id: 'drq', name: 'Dr Q' },
      { id: 'coke', name: 'Coke' },
      { id: 'dietcoke', name: 'Diet Coke' }
    ],
    drinkSizes: [
      { id: 'S', name: 'Small', price: 1 },
      { id: 'M', name: 'Medium', price: 2 },
      { id: 'L', name: 'Large', price: 3 }
    ],
    // PLACEHOLDER dough amounts per pizza. Replace with Luigi's recipe.
    // flour in lb, yeast and salt in oz, olive oil in fl oz
    dough: {
      S: { flour: 0.40, yeast: 0.04, salt: 0.12, oil: 0.25 },
      M: { flour: 0.55, yeast: 0.05, salt: 0.17, oil: 0.35 },
      L: { flour: 0.90, yeast: 0.08, salt: 0.27, oil: 0.50 }
    },
    rewards: { pointsPerDollar: 1, redeemPoints: 50, redeemValue: 5 },

    // PLACEHOLDER costs. Replace with real invoice prices.
    inventory: [
      { id: 'flour', name: 'Bread flour', group: 'Dough', unit: 'lb', cost: 0.55, stock: 150, reorder: 50 },
      { id: 'yeast', name: 'Yeast', group: 'Dough', unit: 'oz', cost: 0.45, stock: 40, reorder: 10 },
      { id: 'salt', name: 'Salt', group: 'Dough', unit: 'oz', cost: 0.03, stock: 200, reorder: 40 },
      { id: 'oil', name: 'Olive oil', group: 'Dough', unit: 'fl oz', cost: 0.30, stock: 200, reorder: 50 },
      { id: 'tomatoes', name: 'Crushed tomatoes (for sauce)', group: 'Sauce and cheese', unit: 'cup', cost: 0.40, stock: 200, reorder: 60 },
      { id: 'mozzarella', name: 'Mozzarella', group: 'Sauce and cheese', unit: 'cup', cost: 1.05, stock: 160, reorder: 50 },
      { id: 'pepperoni', name: 'Pepperoni', group: 'Toppings', unit: 'cup', cost: 1.60, stock: 60, reorder: 20 },
      { id: 'sausage', name: 'Sausage', group: 'Toppings', unit: 'cup', cost: 1.50, stock: 40, reorder: 12 },
      { id: 'beef', name: 'Beef', group: 'Toppings', unit: 'cup', cost: 1.40, stock: 30, reorder: 10 },
      { id: 'greenpepper', name: 'Green peppers', group: 'Toppings', unit: 'cup', cost: 0.45, stock: 30, reorder: 10 },
      { id: 'jalapeno', name: 'Jalapeños', group: 'Toppings', unit: 'cup', cost: 0.50, stock: 25, reorder: 8 },
      { id: 'pineapple', name: 'Pineapple', group: 'Toppings', unit: 'cup', cost: 0.60, stock: 25, reorder: 8 },
      { id: 'onion', name: 'Onion', group: 'Toppings', unit: 'cup', cost: 0.30, stock: 35, reorder: 10 },
      { id: 'olive', name: 'Black olives', group: 'Toppings', unit: 'cup', cost: 0.90, stock: 25, reorder: 8 },
      { id: 'tomato', name: 'Diced tomatoes', group: 'Toppings', unit: 'cup', cost: 0.45, stock: 30, reorder: 10 },
      { id: 'cupS', name: 'Drink, small (cup + syrup)', group: 'Drinks', unit: 'each', cost: 0.18, stock: 300, reorder: 100 },
      { id: 'cupM', name: 'Drink, medium (cup + syrup)', group: 'Drinks', unit: 'each', cost: 0.25, stock: 300, reorder: 100 },
      { id: 'cupL', name: 'Drink, large (cup + syrup)', group: 'Drinks', unit: 'each', cost: 0.32, stock: 300, reorder: 100 },
      { id: 'boxS', name: 'Pizza box, 12 inch', group: 'Packaging', unit: 'each', cost: 0.45, stock: 150, reorder: 50 },
      { id: 'boxM', name: 'Pizza box, 14 inch', group: 'Packaging', unit: 'each', cost: 0.55, stock: 150, reorder: 50 },
      { id: 'boxL', name: 'Pizza box, 18 inch', group: 'Packaging', unit: 'each', cost: 0.80, stock: 150, reorder: 50 }
    ]
  }

  // ---------- Small helpers ----------
  const round2 = n => Math.round(n * 100) / 100
  const money = n => round2(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const pad = n => String(n).padStart(2, '0')
  const digits = str => String(str || '').replace(/\D/g, '')

  function escapeHtml (str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }
  function uid () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }
  function formatPhone (str) {
    const d = digits(str)
    return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(str || '')
  }
  // DEMO ONLY: a simple hash so PINs are not stored as plain text.
  // A real login must be handled by a server (see README).
  function hashPin (pin) {
    let h = 0x811c9dc5
    for (const ch of 'hh-salt:' + pin) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) }
    return (h >>> 0).toString(16)
  }
  function dateKey (d) {
    d = new Date(d)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  function startOfDay (d) {
    d = new Date(d); d.setHours(0, 0, 0, 0); return d
  }
  function addDays (d, n) {
    d = new Date(d); d.setDate(d.getDate() + n); return d
  }
  function timeLabel (ms) {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  function hourLabel (h) {
    h = ((h % 24) + 24) % 24
    return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
  }
  function clock24to12 (hhmm) {
    const [h, m] = hhmm.split(':').map(Number)
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
  }

  // Pop-up messages. Uses SweetAlert2 if it loaded, otherwise plain browser
  // alerts, so the site still works if the free CDN is down.
  function makeDialog () {
    if (window.Swal) return Swal.mixin({ confirmButtonColor: '#B3121F', cancelButtonColor: '#4A5560' })
    const text = o => [o.title, String(o.html || o.text || '').replace(/<li>/g, '\n- ').replace(/<[^>]+>/g, ' ')]
      .filter(Boolean).join('\n').replace(/[ \t]+/g, ' ').trim()
    return {
      fire (o) {
        if (o.toast) return Promise.resolve({ isConfirmed: true })
        if (o.showCancelButton) return Promise.resolve({ isConfirmed: window.confirm(text(o)) })
        window.alert(text(o))
        return Promise.resolve({ isConfirmed: true })
      }
    }
  }

  // ---------- Storage (swap this section for a real database later) ----------
  const PREFIX = 'hh2_'
  function load (key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  function save (key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (err) {
      console.error('Could not save', key, err)
      return false
    }
    window.dispatchEvent(new CustomEvent('hh-change', { detail: key }))
    return true
  }
  // Runs fn when data changes in this tab or any other tab
  function onChange (fn) {
    window.addEventListener('storage', e => {
      if (e.key === null || e.key.startsWith(PREFIX)) fn(e.key ? e.key.slice(PREFIX.length) : '*')
    })
    window.addEventListener('hh-change', e => fn(e.detail))
  }

  // ---------- Menu lookups ----------
  const findBy = (list, id) => list.find(x => x.id === id)
  const size = id => findBy(CONFIG.sizes, id)
  const topping = id => findBy(CONFIG.toppings, id)
  const drink = id => findBy(CONFIG.drinks, id)
  const drinkSize = id => findBy(CONFIG.drinkSizes, id)

  // ---------- Pricing ----------
  function pizzaPrice (sizeId, toppingIds) {
    const s = size(sizeId)
    return s.price + toppingIds.length * s.toppingPrice
  }
  function makePizza (sizeId, toppingIds, qty) {
    const ordered = CONFIG.toppings.map(t => t.id).filter(id => toppingIds.includes(id))
    return { kind: 'pizza', size: sizeId, toppings: ordered, qty, unitPrice: pizzaPrice(sizeId, ordered) }
  }
  function makeDrink (drinkId, sizeId, qty) {
    return { kind: 'drink', drink: drinkId, size: sizeId, qty, unitPrice: drinkSize(sizeId).price }
  }
  // Rebuilds an item with today's prices (used by "Order again")
  function repriceItem (item) {
    return item.kind === 'pizza' ? makePizza(item.size, item.toppings, item.qty) : makeDrink(item.drink, item.size, item.qty)
  }
  function itemTitle (item) {
    if (item.kind === 'pizza') {
      const s = size(item.size)
      return `${s.name} ${s.inches}″ pizza`
    }
    return `${drinkSize(item.size).name} ${drink(item.drink).name}`
  }
  function itemDetail (item) {
    if (item.kind !== 'pizza') return ''
    return item.toppings.length ? item.toppings.map(id => topping(id).name).join(', ') : 'Cheese only'
  }
  function calcTotals (items, redeem) {
    const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0))
    const discount = redeem ? Math.min(CONFIG.rewards.redeemValue, subtotal) : 0
    const taxable = round2(subtotal - discount)
    const tax = round2(taxable * CONFIG.taxRate)
    return {
      subtotal,
      discount,
      tax,
      total: round2(taxable + tax),
      pointsEarned: Math.floor(taxable * CONFIG.rewards.pointsPerDollar),
      pizzaCount: countPizzas(items)
    }
  }
  function countPizzas (items) {
    return items.filter(i => i.kind === 'pizza').reduce((n, i) => n + i.qty, 0)
  }

  // ---------- Inventory and food cost ----------
  function getInventory () {
    return load('inventory', null) || CONFIG.inventory.map(i => ({ ...i }))
  }
  function saveInventory (list) {
    return save('inventory', list)
  }
  // How much of each inventory item one order line uses
  function itemUsage (item, orderType) {
    const use = {}
    const add = (id, amount) => { use[id] = (use[id] || 0) + amount * item.qty }
    if (item.kind === 'pizza') {
      const s = size(item.size)
      const d = CONFIG.dough[s.id]
      add('flour', d.flour); add('yeast', d.yeast); add('salt', d.salt); add('oil', d.oil)
      add('tomatoes', s.cups) // sauce
      add('mozzarella', s.cups)
      item.toppings.forEach(id => add(id, s.cups))
      if (orderType === 'pickup') add('box' + s.id, 1)
    } else {
      add('cup' + item.size, 1)
    }
    return use
  }
  function costMap () {
    const map = {}
    getInventory().forEach(i => { map[i.id] = i.cost })
    return map
  }
  function usageCost (usage, costs) {
    let total = 0
    for (const id in usage) total += usage[id] * (costs[id] || 0)
    return total
  }
  function itemCost (item, orderType, costs = costMap()) {
    return usageCost(itemUsage(item, orderType), costs)
  }
  function orderFoodCost (order, costs = costMap()) {
    return order.items.reduce((sum, item) => sum + itemCost(item, order.type, costs), 0)
  }
  function useInventory (order) {
    const inv = getInventory()
    order.items.forEach(item => {
      const use = itemUsage(item, order.type)
      inv.forEach(row => { if (use[row.id]) row.stock = round2(row.stock - use[row.id]) })
    })
    saveInventory(inv)
  }

  // ---------- Orders ----------
  const STATUSES = [
    { id: 'received', staff: 'New', customer: 'Order received', bump: 'Start making' },
    { id: 'prep', staff: 'Making', customer: 'Being made', bump: 'Into the oven' },
    { id: 'oven', staff: 'In oven', customer: 'In the oven', bump: 'Mark ready' },
    { id: 'ready', staff: 'Ready', customer: 'Ready', bump: 'Picked up' },
    { id: 'done', staff: 'Done', customer: 'Picked up', bump: '' }
  ]
  const ACTIVE = ['received', 'prep', 'oven', 'ready']
  const statusIndex = id => STATUSES.findIndex(s => s.id === id)

  function getOrders () { return load('orders', []) }
  function saveOrders (list) { return save('orders', list) }
  function findOrder (id) { return getOrders().find(o => o.id === id) }

  // Scheduled orders more than 25 minutes away wait in a "later" list
  function isLater (order, now = Date.now()) {
    return order.status === 'received' && order.pickupAt && order.pickupAt - now > 25 * 60000
  }
  function pizzasIn (orders, statuses) {
    return orders.filter(o => statuses.includes(o.status) && !isLater(o)).reduce((n, o) => n + countPizzas(o.items), 0)
  }
  // Minutes until a new order with this many pizzas would be ready
  function estimateMinutes (newPizzas, list = getOrders()) {
    const ahead = pizzasIn(list, ['received', 'prep', 'oven'])
    const batches = Math.max(1, Math.ceil((ahead + newPizzas) / CONFIG.oven.capacity))
    return CONFIG.prepMinutes + batches * CONFIG.oven.cookMinutes + 3
  }

  function placeOrder (data) {
    const now = Date.now()
    const list = getOrders()
    const member = data.customerId ? findCustomer(data.customerId) : null
    const redeem = Boolean(data.redeem && member && member.points >= CONFIG.rewards.redeemPoints)
    const totals = calcTotals(data.items, redeem)
    const minutes = estimateMinutes(totals.pizzaCount, list)
    const number = load('seq', 1000) + 1
    save('seq', number)
    const order = {
      id: uid(),
      number,
      placedAt: now,
      type: data.type, // 'pickup' or 'dinein'
      table: data.table || '',
      pickupAt: data.pickupAt || null, // null means as soon as possible
      promisedAt: Math.max(data.pickupAt || 0, now + minutes * 60000),
      name: data.name,
      phone: digits(data.phone),
      email: data.email || '',
      customerId: data.customerId || null,
      items: data.items,
      notes: data.notes || '',
      payment: data.payment, // paid at the counter
      ...totals,
      pointsUsed: redeem ? CONFIG.rewards.redeemPoints : 0,
      status: 'received',
      t: { received: now }
    }
    list.push(order)
    saveOrders(list)
    useInventory(order)
    if (order.customerId) {
      const customers = getCustomers()
      const c = customers.find(x => x.id === order.customerId)
      if (c) {
        c.points = Math.max(0, c.points - order.pointsUsed + order.pointsEarned)
        saveCustomers(customers)
      }
    }
    return order
  }

  // Moves an order to a status. Moving backward (undo) clears later times.
  function setStatus (id, status) {
    const list = getOrders()
    const order = list.find(o => o.id === id)
    if (!order) return null
    const to = statusIndex(status)
    STATUSES.forEach((s, i) => { if (i > to) delete order.t[s.id] })
    if (!order.t[status]) order.t[status] = Date.now()
    order.status = status
    saveOrders(list)
    return order
  }

  // ---------- Customers and rewards ----------
  function getCustomers () { return load('customers', []) }
  function saveCustomers (list) { return save('customers', list) }
  function findCustomer (id) { return getCustomers().find(c => c.id === id) || null }
  function findCustomerByPhone (phone) {
    const d = digits(phone)
    return getCustomers().find(c => c.phone === d) || null
  }
  function createCustomer ({ name, phone, email, pin }) {
    const list = getCustomers()
    const customer = { id: uid(), name, phone: digits(phone), email: email || '', pinHash: hashPin(pin), points: 0, createdAt: Date.now() }
    list.push(customer)
    saveCustomers(list)
    return customer
  }
  function signInCustomer (phone, pin) {
    const c = findCustomerByPhone(phone)
    return c && c.pinHash === hashPin(pin) ? c : null
  }
  function currentCustomer () {
    const id = load('session_customer', null)
    return id ? findCustomer(id) : null
  }
  function setCurrentCustomer (id) { save('session_customer', id) }

  // ---------- Staff, schedule, time clock ----------
  function getEmployees () { return load('employees', []) }
  function findEmployee (id) { return getEmployees().find(e => e.id === id) || null }
  function employeeByPin (pin) {
    const h = hashPin(pin)
    return getEmployees().find(e => e.pinHash === h) || null
  }
  function getShifts () { return load('shifts', []) }
  function saveShifts (list) { return save('shifts', list) }
  function toMinutes (hhmm) {
    const [h, m] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  function shiftHours (s) {
    let mins = toMinutes(s.end) - toMinutes(s.start)
    if (mins < 0) mins += 24 * 60
    return mins / 60
  }
  function getPunches () { return load('punches', []) }
  function savePunches (list) { return save('punches', list) }

  // ---------- Hours ----------
  function getSettings () { return load('settings', { alwaysOpen: false }) }
  function saveSettings (s) { return save('settings', s) }
  function isOpen (d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60
    return h >= CONFIG.openHour && h < CONFIG.closeHour
  }
  // ASAP orders are taken while open (or always, in demo mode)
  function takingAsap () {
    return isOpen() || getSettings().alwaysOpen
  }
  // Pickup times every 15 minutes, starting 30 minutes from now, up to tomorrow night
  function pickupSlots (now = new Date()) {
    const slots = []
    const t = new Date(now.getTime() + 30 * 60000)
    t.setSeconds(0, 0)
    t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15)
    for (let i = 0; i < 160; i++) {
      const h = t.getHours() + t.getMinutes() / 60
      if (h >= CONFIG.openHour + 0.25 && h <= CONFIG.closeHour - 0.25) slots.push(t.getTime())
      if (dateKey(t) !== dateKey(now) && dateKey(t) !== dateKey(addDays(now, 1))) break
      t.setMinutes(t.getMinutes() + 15)
    }
    return slots
  }

  // ---------- Demo data ----------
  const SEED_VERSION = 4
  function seededRandom (seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function seedIfNeeded () {
    if (load('seed_version', 0) !== SEED_VERSION) resetDemo()
  }
  function resetDemo () {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
    const rand = seededRandom(20261005)
    const pickOne = list => list[Math.floor(rand() * list.length)]
    const pickWeighted = weights => {
      const total = Object.values(weights).reduce((a, b) => a + b, 0)
      let r = rand() * total
      for (const k in weights) { r -= weights[k]; if (r <= 0) return k }
      return Object.keys(weights)[0]
    }
    const poisson = lambda => {
      const L = Math.exp(-lambda); let k = 0; let p = 1
      do { k++; p *= rand() } while (p > L)
      return k - 1
    }

    // Staff: Luigi plus 11 part-time employees ($16 to $18 an hour)
    const staffNames = ['Ava Martin', 'Ben Carter', 'Chloe Nguyen', 'Diego Ramirez', 'Emma Brooks', 'Jalen Price',
      'Maya Patel', 'Noah Fisher', 'Olivia Grant', 'Sam Turner', 'Tyler Hayes']
    const employees = [{ id: 'e0', name: 'Luigi', role: 'manager', title: 'Owner', wage: 0, pinHash: hashPin('1234') }]
    staffNames.forEach((name, i) => {
      employees.push({ id: 'e' + (i + 1), name, role: 'staff', title: 'Part-time', wage: 16 + (i % 3), pinHash: hashPin(String(1111 + i)) })
    })

    // Schedule: 4 people per shift (front, 2 prep/cooks, floater)
    const today = startOfDay(new Date())
    const staff = employees.slice(1)
    const shifts = []
    let next = 0
    const pick = () => staff[(next++) % staff.length]
    for (let off = -42; off <= 13; off++) {
      const day = addDays(today, off)
      const date = dateKey(day)
      const add = (emp, start, end, position, desc) => shifts.push({ id: uid(), empId: emp.id, date, start, end, position, desc })
      const frontDesc = 'Register, phones, and pickup counter'
      add(day.getDay() === 0 ? pick() : employees[0], '09:30', '16:30', 'Front counter', frontDesc)
      add(pick(), '09:30', '16:30', 'Prep / cook', 'Opening: mix dough, make sauce, stock the make line')
      add(pick(), '09:30', '16:30', 'Prep / cook', 'Make line and oven')
      add(pick(), '10:00', '16:30', 'Floater', 'Dishes, dining room, help wherever the line is busy')
      add(pick(), '16:00', '23:30', 'Front counter', frontDesc + '. Count the drawer at close')
      add(pick(), '16:00', '23:30', 'Prep / cook', 'Make line and oven')
      add(pick(), '16:00', '23:30', 'Prep / cook', 'Closing: portion dough for tomorrow, clean the oven')
      add(pick(), '16:00', '23:00', 'Floater', 'Dishes, dining room, trash at close')
    }

    // Customers
    const firsts = ['Pat', 'Linda', 'Gary', 'Carol', 'Mike', 'Donna', 'Ray', 'Brenda', 'Jim', 'Sue', 'Earl', 'Joan', 'Kyle', 'Dana', 'Will', 'Rosa']
    const lasts = ['Miller', 'Smith', 'Jones', 'Davis', 'Clark', 'Hall', 'Lewis', 'Young', 'King', 'Wright', 'Hill', 'Green']
    const customers = [{ id: 'c0', name: 'Pat Miller', phone: '9315550100', email: 'pat@example.com', pinHash: hashPin('1234'), points: 58, createdAt: Date.now() }]
    for (let i = 1; i < 40; i++) {
      customers.push({ id: 'c' + i, name: `${pickOne(firsts)} ${pickOne(lasts)}`, phone: '9315550' + String(100 + i).slice(-3), email: '', pinHash: hashPin(String(Math.floor(rand() * 9000) + 1000)), points: Math.floor(rand() * 80), createdAt: Date.now() })
    }

    // Order history: 6 weeks, lunch and dinner rushes, busier on weekends
    const hourWeights = { 10: 2, 11: 6, 12: 9, 13: 6, 14: 3, 15: 3, 16: 4, 17: 8, 18: 11, 19: 10, 20: 7, 21: 4, 22: 2 }
    const dayFactor = [1.05, 0.65, 0.7, 0.8, 0.9, 1.25, 1.35] // Sun to Sat
    const toppingWeights = { pepperoni: 30, sausage: 14, beef: 8, greenpepper: 9, jalapeno: 7, pineapple: 6, onion: 10, olive: 7, tomato: 9 }
    const now = Date.now()
    const orders = []
    let number = 1000

    const randomItems = () => {
      const items = []
      const pizzas = pickWeighted({ 1: 55, 2: 32, 3: 10, 4: 3 })
      for (let i = 0; i < pizzas; i++) {
        const sizeId = pickWeighted({ S: 25, M: 35, L: 40 })
        const count = Number(pickWeighted({ 0: 25, 1: 35, 2: 25, 3: 15 }))
        const tops = []
        while (tops.length < count) {
          const t = pickWeighted(toppingWeights)
          if (!tops.includes(t)) tops.push(t)
        }
        items.push(makePizza(sizeId, tops, 1))
        if (rand() < 0.5) items.push(makeDrink(pickOne(CONFIG.drinks).id, pickWeighted({ S: 30, M: 45, L: 25 }), 1))
      }
      return items
    }

    for (let off = -42; off <= 0; off++) {
      const day = addDays(today, off)
      const growth = 0.9 + 0.1 * ((off + 42) / 42)
      for (let h = CONFIG.openHour; h < CONFIG.closeHour; h++) {
        const count = poisson(hourWeights[h] * dayFactor[day.getDay()] * growth * 0.95)
        const extraWait = Math.max(0, count - 8) * 0.6
        for (let i = 0; i < count; i++) {
          const received = day.getTime() + h * 3600000 + Math.floor(rand() * 3600000)
          const type = rand() < 0.62 ? 'pickup' : 'dinein'
          const prep = received + (1 + rand() * 2 + extraWait) * 60000
          const oven = prep + (3 + rand() * 2.5) * 60000
          const ready = oven + (CONFIG.oven.cookMinutes + (rand() < 0.25 ? rand() * 3 : 0)) * 60000
          const done = ready + (type === 'pickup' ? 2 + rand() * 10 : 1 + rand() * 2) * 60000
          if (done > now) continue
          const items = randomItems()
          const member = rand() < 0.3 ? pickOne(customers) : null
          orders.push({
            id: uid(),
            number: ++number,
            placedAt: received,
            type,
            table: type === 'dinein' ? String(1 + Math.floor(rand() * 14)) : '',
            pickupAt: null,
            promisedAt: received + 20 * 60000,
            name: member ? member.name : `${pickOne(firsts)} ${pickOne(lasts)}`,
            phone: member ? member.phone : '',
            email: '',
            customerId: member ? member.id : null,
            items,
            notes: '',
            payment: rand() < 0.7 ? 'Card' : 'Cash',
            ...calcTotals(items, false),
            pointsUsed: 0,
            status: 'done',
            t: { received, prep, oven, ready, done }
          })
        }
      }
    }
    orders.sort((a, b) => a.placedAt - b.placedAt)
    orders.forEach((o, i) => { o.number = 1001 + i })
    number = 1000 + orders.length

    // A few live orders so the kitchen screen has something on it
    const live = [
      { mins: 9, status: 'oven', name: 'Linda Davis', type: 'pickup' },
      { mins: 5, status: 'prep', name: 'Ray Young', type: 'dinein', table: '6' },
      { mins: 1, status: 'received', name: 'Pat Miller', type: 'pickup', customerId: 'c0', notes: 'Well done, please' }
    ]
    live.forEach(l => {
      const received = now - l.mins * 60000
      const items = randomItems()
      const t = { received }
      if (statusIndex(l.status) >= 1) t.prep = received + 2 * 60000
      if (statusIndex(l.status) >= 2) t.oven = received + 6 * 60000
      orders.push({
        id: uid(), number: ++number, placedAt: received, type: l.type, table: l.table || '', pickupAt: null,
        promisedAt: received + 20 * 60000, name: l.name, phone: '9315550100', email: '', customerId: l.customerId || null,
        items, notes: l.notes || '', payment: 'Card', ...calcTotals(items, false), pointsUsed: 0, status: l.status, t
      })
    })

    save('employees', employees)
    save('shifts', shifts)
    save('customers', customers)
    save('inventory', CONFIG.inventory.map(i => ({ ...i })))
    save('orders', orders)
    save('seq', number)
    save('punches', [])
    save('settings', { alwaysOpen: false })
    save('seed_version', SEED_VERSION)
  }

  return {
    CONFIG, STATUSES, ACTIVE,
    makeDialog, round2, money, escapeHtml, uid, digits, formatPhone, hashPin, dateKey, startOfDay, addDays, timeLabel, hourLabel, clock24to12, toMinutes,
    load, save, onChange,
    size, topping, drink, drinkSize,
    pizzaPrice, makePizza, makeDrink, repriceItem, itemTitle, itemDetail, calcTotals, countPizzas,
    getInventory, saveInventory, itemUsage, costMap, usageCost, itemCost, orderFoodCost,
    statusIndex, getOrders, saveOrders, findOrder, isLater, pizzasIn, estimateMinutes, placeOrder, setStatus,
    getCustomers, saveCustomers, findCustomer, findCustomerByPhone, createCustomer, signInCustomer, currentCustomer, setCurrentCustomer,
    getEmployees, findEmployee, employeeByPin, getShifts, saveShifts, shiftHours, getPunches, savePunches,
    getSettings, saveSettings, isOpen, takingAsap, pickupSlots,
    seedIfNeeded, resetDemo
  }
})()
