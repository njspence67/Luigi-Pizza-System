const regEmail = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i
const arrStatuses = ['Received', 'Preparing', 'In Oven', 'Ready', 'Completed']
const objSizePrices = { Small: 5, Medium: 7, Large: 9 }
const objExtraToppingPrices = { Small: 1, Medium: 2, Large: 3 }
const objDrinkPrices = { Small: 1, Medium: 2, Large: 3 }
const strStorageKey = 'luigisPizzeriaDemoV1'

function getSeedState() {
  return {
    nextOrderNumber: 108,
    cart: [],
    orders: [
      { id: 'L-104', customer: 'Morgan R.', fulfillment: 'Pickup', status: 'Preparing', items: [{ name: 'Large pizza', detail: 'Pepperoni, onion', price: 12 }, { name: 'Iced tea · Medium', detail: '', price: 2 }], total: 14, time: '12:08 PM', isSample: true },
      { id: 'L-105', customer: 'Alex C.', fulfillment: 'Dine-in', tableNumber: '4', status: 'In Oven', items: [{ name: 'Medium pizza', detail: 'Sausage, green pepper', price: 9 }], total: 9, time: '12:13 PM', isSample: true },
      { id: 'L-106', customer: 'Jamie P.', fulfillment: 'Pickup', status: 'Ready', items: [{ name: 'Small pizza', detail: 'Black olives', price: 5 }, { name: 'Coke · Small', detail: '', price: 1 }], total: 6, time: '12:16 PM', isSample: true }
    ]
  }
}

function loadState() {
  try {
    const strSaved = localStorage.getItem(strStorageKey)
    if (strSaved) {
      const objSaved = JSON.parse(strSaved)
      if (objSaved && Array.isArray(objSaved.orders) && Array.isArray(objSaved.cart)) return objSaved
    }
  } catch (err) {
    // Storage is optional; the demo still works in memory if the browser blocks it.
  }
  return getSeedState()
}

let objState = loadState()
let strFulfillment = 'Dine-in'

function saveState() {
  try { localStorage.setItem(strStorageKey, JSON.stringify(objState)) } catch (err) {
    // Private browsing or storage restrictions should not block ordering in the demo.
  }
}

function escapeHtml(strValue) {
  return String(strValue ?? '').replace(/[&<>"']/g, (strChar) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[strChar])
}

function formatMoney(numValue) {
  return `$${Number(numValue || 0).toFixed(0)}`
}

function getSelectedSize() {
  const elSelected = document.querySelector('input[name="pizzaSize"]:checked')
  return elSelected ? elSelected.value : 'Medium'
}

function getSelectedToppings() {
  return [...document.querySelectorAll('input[name="topping"]:checked')].map((elTopping) => elTopping.value)
}

function getPizzaPrice(strSize, arrToppings) {
  const intExtras = Math.max(0, arrToppings.length - 1)
  return objSizePrices[strSize] + intExtras * objExtraToppingPrices[strSize]
}

function getCartTotal() {
  return objState.cart.reduce((numTotal, objItem) => numTotal + Number(objItem.price || 0), 0)
}

function showNotice(strTitle, strMessage, strIcon = 'info') {
  if (window.Swal) {
    window.Swal.fire({ title: strTitle, text: strMessage, icon: strIcon, confirmButtonText: 'Got it', confirmButtonColor: '#435b46' })
  } else {
    window.alert(`${strTitle}\n\n${strMessage}`)
  }
}

function updatePizzaPreview() {
  const strSize = getSelectedSize()
  const arrToppings = getSelectedToppings()
  const intPrice = getPizzaPrice(strSize, arrToppings)
  const elPrice = document.querySelector('#pizzaPricePreview')
  const elHint = document.querySelector('#toppingPriceHint')
  const elSize = document.querySelector('input[name="pizzaSize"]:checked')
  elPrice.textContent = `Pizza subtotal: ${formatMoney(intPrice)}`
  elHint.textContent = `Base price includes sauce, cheese, and one topping. Each extra topping is ${formatMoney(objExtraToppingPrices[strSize])} for a ${strSize.toLowerCase()}.`
  document.querySelectorAll('.size-card').forEach((elCard) => elCard.classList.toggle('is-selected', elCard.contains(elSize)))
}

function getCartLineMarkup(objItem, intIndex) {
  const strDetail = objItem.detail ? `<p class="cart-line-detail">${escapeHtml(objItem.detail)}</p>` : ''
  return `<article class="cart-line"><div><div class="cart-line-title">${escapeHtml(objItem.name)}</div>${strDetail}</div><span class="cart-line-price">${formatMoney(objItem.price)}</span><button class="cart-remove" type="button" data-remove-index="${intIndex}" aria-label="Remove ${escapeHtml(objItem.name)} from cart">Remove</button></article>`
}

function renderCart() {
  const elCart = document.querySelector('#cartItems')
  elCart.innerHTML = objState.cart.length ? objState.cart.map(getCartLineMarkup).join('') : '<p class="empty-cart">Your cart is waiting for something delicious.</p>'
  document.querySelector('#cartSubtotal').textContent = formatMoney(getCartTotal())
  document.querySelector('#cartCount').textContent = String(objState.cart.length)
  document.querySelector('#btnCheckout').disabled = objState.cart.length === 0
  document.querySelector('#btnClearCart').disabled = objState.cart.length === 0
  renderCheckoutSummary()
}

function renderCheckoutSummary() {
  const elSummary = document.querySelector('#checkoutSummary')
  if (!elSummary) return
  const strLines = objState.cart.map((objItem) => `<div class="summary-row"><span>${escapeHtml(objItem.name)}<small>${escapeHtml(objItem.detail || '')}</small></span><strong>${formatMoney(objItem.price)}</strong></div>`).join('')
  elSummary.innerHTML = `<div class="summary-heading">${escapeHtml(strFulfillment)} · ${objState.cart.length} item${objState.cart.length === 1 ? '' : 's'}</div>${strLines}<div class="summary-row summary-total"><span>Demo subtotal</span><strong>${formatMoney(getCartTotal())}</strong></div><p class="fine-print">Tax is not calculated in this demo.</p>`
}

function addPizzaToCart() {
  const strSize = getSelectedSize()
  const arrToppings = getSelectedToppings()
  if (arrToppings.length === 0) {
    showNotice('Choose a topping', 'Please choose at least one topping for this demo pizza.', 'warning')
    document.querySelector('input[name="topping"]')?.focus()
    return
  }
  const strInches = document.querySelector('input[name="pizzaSize"]:checked')?.dataset.inches || ''
  const objPizza = {
    name: `${strSize} ${strInches}″ pizza`,
    detail: `New York crust · Sauce · Cheese · ${arrToppings.join(', ')}`,
    price: getPizzaPrice(strSize, arrToppings),
    kind: 'pizza'
  }
  objState.cart.push(objPizza)
  saveState()
  renderCart()
  showNotice('Added to your cart', `${objPizza.name} is in your cart.`, 'success')
}

function addDrinkToCart(elButton) {
  const strDrink = elButton.dataset.drink
  const elSelect = elButton.closest('.drink-card')?.querySelector('select')
  const strSize = elSelect?.value || 'Small'
  objState.cart.push({ name: `${strSize} ${strDrink}`, detail: 'Drink', price: objDrinkPrices[strSize], kind: 'drink' })
  saveState()
  renderCart()
  showNotice('Added to your cart', `${strSize} ${strDrink} is in your cart.`, 'success')
}

function removeCartItem(intIndex) {
  objState.cart.splice(intIndex, 1)
  saveState()
  renderCart()
}

function renderHistory() {
  const arrOrders = [...objState.orders].reverse().slice(0, 4)
  document.querySelector('#customerHistory').innerHTML = arrOrders.length ? arrOrders.map((objOrder) => {
    const strItemSummary = objOrder.items.map((objItem) => objItem.name).join(', ')
    return `<div class="history-row"><span><strong>${escapeHtml(objOrder.id)} · ${escapeHtml(objOrder.status)}</strong><small>${escapeHtml(strItemSummary)} · ${escapeHtml(objOrder.time)}</small></span><span class="history-total">${formatMoney(objOrder.total)}</span></div>`
  }).join('') : '<p class="empty-cart">No orders yet. Your first order will appear here.</p>'
}

function getStatusProgress(strStatus) {
  const intIndex = arrStatuses.indexOf(strStatus)
  if (strStatus === 'Cancelled' || intIndex < 0) return 0
  return intIndex * 25
}

function statusClass(strStatus) {
  return strStatus.toLowerCase().replaceAll(' ', '-')
}

function renderTrackerOptions() {
  const elSelect = document.querySelector('#orderSelect')
  const arrOrders = [...objState.orders].reverse()
  if (!arrOrders.length) {
    elSelect.innerHTML = '<option value="">No orders yet</option>'
    renderTracker()
    return
  }
  const strPreviousValue = elSelect.value
  elSelect.innerHTML = arrOrders.map((objOrder) => `<option value="${escapeHtml(objOrder.id)}">${escapeHtml(objOrder.id)} · ${escapeHtml(objOrder.customer)} · ${escapeHtml(objOrder.status)}</option>`).join('')
  if (arrOrders.some((objOrder) => objOrder.id === strPreviousValue)) elSelect.value = strPreviousValue
  else elSelect.value = arrOrders[0].id
  renderTracker()
}

function renderTracker() {
  const elSelect = document.querySelector('#orderSelect')
  const objOrder = objState.orders.find((objCandidate) => objCandidate.id === elSelect.value) || objState.orders[objState.orders.length - 1]
  const elStatus = document.querySelector('#trackerStatus')
  const elContent = document.querySelector('#trackerContent')
  if (!objOrder) {
    elStatus.textContent = 'No order'
    elStatus.className = 'status-badge'
    elContent.innerHTML = '<p class="empty-cart">Place a demo order to see it here.</p>'
    return
  }
  elStatus.textContent = objOrder.status
  elStatus.className = `status-badge status-${statusClass(objOrder.status)}`
  const intProgress = getStatusProgress(objOrder.status)
  const intCurrent = arrStatuses.indexOf(objOrder.status)
  const strSteps = arrStatuses.map((strStep, intIndex) => `<span class="progress-step ${intIndex < intCurrent ? 'is-done' : ''} ${intIndex === intCurrent ? 'is-current' : ''}">${escapeHtml(strStep)}</span>`).join('')
  const strContents = objOrder.items.map((objItem) => escapeHtml(objItem.name)).join(', ')
  elContent.innerHTML = `<div class="tracker-order-meta"><span><strong>${escapeHtml(objOrder.id)}</strong> · ${escapeHtml(objOrder.fulfillment)}${objOrder.tableNumber ? ` · Table ${escapeHtml(objOrder.tableNumber)}` : ''}</span><span>Placed ${escapeHtml(objOrder.time)}</span></div><div class="progress-track" role="progressbar" aria-label="Order progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${intProgress}"><div class="progress-fill" style="width:${intProgress}%"></div></div><div class="progress-steps">${strSteps}</div><p class="tracker-items"><strong>Order items:</strong> ${strContents}<br><strong>Demo total:</strong> ${formatMoney(objOrder.total)} · no payment collected</p>`
}

function renderKitchen() {
  const elQueue = document.querySelector('#kitchenQueue')
  const arrOrders = [...objState.orders].reverse()
  const intActive = arrOrders.filter((objOrder) => !['Completed', 'Cancelled'].includes(objOrder.status)).length
  document.querySelector('#queueCount').textContent = String(intActive)
  if (!arrOrders.length) {
    elQueue.innerHTML = '<div class="empty-queue">No tickets yet. New demo orders will appear here.</div>'
    return
  }
  elQueue.innerHTML = arrOrders.map((objOrder) => {
    const blnComplete = ['Completed', 'Cancelled'].includes(objOrder.status)
    const strNext = objOrder.status === 'Cancelled' ? 'Cancelled' : arrStatuses[Math.min(arrStatuses.indexOf(objOrder.status) + 1, arrStatuses.length - 1)]
    const strItemLines = objOrder.items.map((objItem) => `${objItem.name}${objItem.detail ? ` · ${objItem.detail}` : ''}`).join(' | ')
    return `<article class="ticket-card ticket-${statusClass(objOrder.status)}"><div class="ticket-top"><strong class="ticket-number">${escapeHtml(objOrder.id)}</strong><span class="ticket-time">${escapeHtml(objOrder.time)}</span></div><span class="ticket-status status-${statusClass(objOrder.status)}">${escapeHtml(objOrder.status)}</span><p class="ticket-customer">${escapeHtml(objOrder.customer)} · ${escapeHtml(objOrder.fulfillment)}${objOrder.tableNumber ? ` · Table ${escapeHtml(objOrder.tableNumber)}` : ''}</p><p class="ticket-items">${escapeHtml(strItemLines)}</p><div class="ticket-actions">${blnComplete ? '<button class="button button-secondary" type="button" disabled>Ticket closed</button>' : `<button class="button button-primary" type="button" data-advance-order="${escapeHtml(objOrder.id)}" aria-label="Advance ${escapeHtml(objOrder.id)} from ${escapeHtml(objOrder.status)} to ${escapeHtml(strNext)}">${objOrder.status === 'Ready' ? 'Mark done' : `Next: ${escapeHtml(strNext)}`}</button>`}</div></article>`
  }).join('')
}

function renderManagerCharts() {
  const arrHours = [{ label: '11a', value: 4 }, { label: '12p', value: 12 }, { label: '1p', value: 9 }, { label: '2p', value: 5 }, { label: '5p', value: 7 }, { label: '6p', value: 15 }, { label: '7p', value: 13 }, { label: '8p', value: 8 }]
  const arrDays = [{ label: 'Mon', value: 22 }, { label: 'Tue', value: 26 }, { label: 'Wed', value: 31 }, { label: 'Thu', value: 29 }, { label: 'Fri', value: 48 }, { label: 'Sat', value: 57 }, { label: 'Sun', value: 42 }]
  const getBarMarkup = (objDatum, intMax) => `<div class="bar-column"><span class="bar-value">${objDatum.value}</span><div class="bar" style="height:${Math.round(objDatum.value / intMax * 100)}%"></div><span class="bar-label">${objDatum.label}</span></div>`
  document.querySelector('#hourChart').innerHTML = arrHours.map((objDatum) => getBarMarkup(objDatum, 16)).join('')
  document.querySelector('#dayChart').innerHTML = arrDays.map((objDatum) => getBarMarkup(objDatum, 60)).join('')
  const arrMenu = [{ label: 'Medium', value: 38 }, { label: 'Large', value: 27 }, { label: 'Small', value: 18 }, { label: 'Pepperoni', value: 52 }, { label: 'Sausage', value: 31 }, { label: 'Green pepper', value: 24 }]
  document.querySelector('#menuChart').innerHTML = arrMenu.map((objDatum) => `<div class="menu-bar-row"><span>${escapeHtml(objDatum.label)}</span><div class="menu-bar-track"><div class="menu-bar-fill" style="width:${objDatum.value}%"></div></div><span class="menu-bar-value">${objDatum.value}%</span></div>`).join('')
}

function renderAll() {
  renderCart()
  renderHistory()
  renderTrackerOptions()
  renderKitchen()
  renderManagerCharts()
}

function showView(strViewId) {
  document.querySelectorAll('.app-view').forEach((elView) => {
    const blnIsSelected = elView.id === strViewId
    elView.classList.toggle('is-visible', blnIsSelected)
    elView.hidden = !blnIsSelected
  })
  document.querySelectorAll('[data-view]').forEach((elButton) => {
    const blnIsSelected = elButton.dataset.view === strViewId
    elButton.classList.toggle('is-active', blnIsSelected)
    if (blnIsSelected) elButton.setAttribute('aria-current', 'page')
    else elButton.removeAttribute('aria-current')
  })
  document.querySelector('#mainContent').focus({ preventScroll: true })
  scrollToTop()
}

function scrollToTop() {
  const strBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  window.scrollTo({ top: 0, behavior: strBehavior })
}

function setFulfillment(strValue) {
  strFulfillment = strValue
  document.querySelector('#tableNumberWrap').hidden = strFulfillment !== 'Dine-in'
  renderCheckoutSummary()
}

function openCheckout() {
  if (!objState.cart.length) return
  document.querySelector('#builderStage').hidden = true
  document.querySelector('#checkoutStage').hidden = false
  document.querySelector('#checkoutError').hidden = true
  document.querySelector('#txtCustomerName').focus()
  renderCheckoutSummary()
  scrollToTop()
}

function backToOrder() {
  document.querySelector('#checkoutStage').hidden = true
  document.querySelector('#builderStage').hidden = false
  document.querySelector('#btnCheckout').focus()
}

function handleCheckoutSubmit(event) {
  event.preventDefault()
  const elName = document.querySelector('#txtCustomerName')
  const elPhone = document.querySelector('#txtCustomerPhone')
  const elEmail = document.querySelector('#txtCustomerEmail')
  const strName = elName.value.trim()
  const strPhone = elPhone.value.trim()
  const strEmail = elEmail.value.trim()
  const strError = document.querySelector('#checkoutError')
  let elInvalid = null
  let strMessage = ''
  for (const elInput of [elName, elPhone, elEmail]) elInput.removeAttribute('aria-invalid')
  if (!strName) {
    strMessage = 'Enter your name so the team knows who to call.'
    elInvalid = elName
  } else if (!strPhone) {
    strMessage = 'Enter a phone number for your order.'
    elInvalid = elPhone
  } else if (strEmail && !regEmail.test(strEmail)) {
    strMessage = 'Enter a valid email address or leave it blank.'
    elInvalid = elEmail
  }
  if (strMessage) {
    strError.textContent = strMessage
    strError.hidden = false
    elInvalid?.setAttribute('aria-invalid', 'true')
    elInvalid?.focus()
    return
  }
  strError.hidden = true
  const strOrderId = `L-${objState.nextOrderNumber++}`
  const strTableNumber = strFulfillment === 'Dine-in' ? document.querySelector('#txtTableNumber').value.trim() : ''
  const objOrder = {
    id: strOrderId,
    customer: strName,
    phone: strPhone,
    email: strEmail,
    fulfillment: strFulfillment,
    tableNumber: strTableNumber,
    status: 'Received',
    items: [...objState.cart],
    total: getCartTotal(),
    time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    isSample: false
  }
  objState.orders.push(objOrder)
  objState.cart = []
  saveState()
  renderAll()
  document.querySelector('#checkoutStage').hidden = true
  document.querySelector('#builderStage').hidden = false
  document.querySelector('#checkoutForm').reset()
  document.querySelector('#txtTableNumber').value = ''
  showView('trackingView')
  document.querySelector('#orderSelect').value = strOrderId
  renderTracker()
  showNotice('Demo order placed', `Order ${strOrderId} is in the local kitchen queue. No payment was collected.`, 'success')
}

function advanceOrder(strOrderId) {
  const objOrder = objState.orders.find((objCandidate) => objCandidate.id === strOrderId)
  if (!objOrder) return
  const intCurrentIndex = arrStatuses.indexOf(objOrder.status)
  if (intCurrentIndex < 0 || intCurrentIndex >= arrStatuses.length - 1) return
  objOrder.status = arrStatuses[intCurrentIndex + 1]
  saveState()
  renderHistory()
  renderTrackerOptions()
  renderKitchen()
}

function init() {
  document.querySelectorAll('[data-view]').forEach((elButton) => elButton.addEventListener('click', () => showView(elButton.dataset.view)))
  document.querySelectorAll('input[name="pizzaSize"], input[name="topping"]').forEach((elInput) => elInput.addEventListener('change', updatePizzaPreview))
  document.querySelectorAll('input[name="fulfillment"]').forEach((elInput) => elInput.addEventListener('change', () => setFulfillment(elInput.value)))
  document.querySelector('#btnAddPizza').addEventListener('click', addPizzaToCart)
  document.querySelectorAll('.btnAddDrink').forEach((elButton) => elButton.addEventListener('click', () => addDrinkToCart(elButton)))
  document.querySelector('#cartItems').addEventListener('click', (event) => {
    const elRemove = event.target.closest('[data-remove-index]')
    if (elRemove) removeCartItem(Number(elRemove.dataset.removeIndex))
  })
  document.querySelector('#btnClearCart').addEventListener('click', () => {
    objState.cart = []
    saveState()
    renderCart()
  })
  document.querySelector('#btnCheckout').addEventListener('click', openCheckout)
  document.querySelector('#btnBackToOrder').addEventListener('click', backToOrder)
  document.querySelector('#checkoutForm').addEventListener('submit', handleCheckoutSubmit)
  document.querySelector('#checkoutForm').addEventListener('input', () => {
    document.querySelector('#checkoutError').hidden = true
    document.querySelectorAll('#checkoutForm [aria-invalid="true"]').forEach((elInput) => elInput.removeAttribute('aria-invalid'))
  })
  document.querySelector('#orderSelect').addEventListener('change', renderTracker)
  document.querySelector('#kitchenQueue').addEventListener('click', (event) => {
    const elAdvanceButton = event.target.closest('[data-advance-order]')
    if (elAdvanceButton) advanceOrder(elAdvanceButton.dataset.advanceOrder)
  })
  updatePizzaPreview()
  renderAll()
}

document.addEventListener('DOMContentLoaded', init)
