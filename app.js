import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'

const regEmail = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i
const arrStatuses = ['Received', 'Preparing', 'In Oven', 'Ready', 'Completed']
const objSizePrices = { Small: 5, Medium: 7, Large: 9 }
const objExtraToppingPrices = { Small: 1, Medium: 2, Large: 3 }
const objDrinkPrices = { Small: 1, Medium: 2, Large: 3 }
const strCartStorageKey = 'luigisPizzaCartV2'

let objState = { cart: loadCart() }
let strFulfillment = 'Dine-in'
let firebaseApp = null
let firebaseAuth = null
let firestore = null
let blnFirebaseReady = false
let blnKitchenStaff = false
let blnManager = false
let strStaffEmail = ''
let strPendingStaffView = null
let arrStaffOrders = []
let objLastReceipt = null
let stopKitchenListener = null

function loadCart() {
  try {
    const objSaved = JSON.parse(localStorage.getItem(strCartStorageKey) || 'null')
    if (Array.isArray(objSaved)) return objSaved
  } catch (err) {
    // Cart persistence is optional; blocked browser storage should not prevent ordering.
  }
  return []
}

function saveCart() {
  try { localStorage.setItem(strCartStorageKey, JSON.stringify(objState.cart)) } catch (err) {
    // The cart remains available in memory when browser storage is unavailable.
  }
}

function getFirebaseConfig() {
  const objConfig = window.LUIGI_FIREBASE_CONFIG
  if (!objConfig || typeof objConfig !== 'object') return null
  const arrRequiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
  if (arrRequiredKeys.some((strKey) => !objConfig[strKey] || String(objConfig[strKey]).includes('YOUR_'))) return null
  return objConfig
}

function setupFirebase() {
  const objConfig = getFirebaseConfig()
  if (!objConfig) {
    setFirebaseNotice('Firebase needs setup. Add your Firebase web app settings to firebase-config.js, then configure Authentication, Firestore, and the rules in firestore.rules.')
    renderAccessState()
    return
  }
  try {
    firebaseApp = initializeApp(objConfig)
    firebaseAuth = getAuth(firebaseApp)
    firestore = getFirestore(firebaseApp)
    blnFirebaseReady = true
    setFirebaseNotice('Firebase is connected. Orders are stored online; only authorized kitchen staff can read the live queue.')
    renderCart()
    renderAccessState()
    onAuthStateChanged(firebaseAuth, handleAuthChanged, (objError) => {
      clearStaffAccess()
      setKitchenLoginError(`Authentication could not start: ${friendlyError(objError)}`)
      renderAccessState()
    })
  } catch (objError) {
    setFirebaseNotice(`Firebase could not start: ${friendlyError(objError)}`)
    blnFirebaseReady = false
    renderAccessState()
  }
}

function setFirebaseNotice(strMessage) {
  const elNotice = document.querySelector('#firebaseNotice')
  if (!elNotice) return
  elNotice.textContent = strMessage
  elNotice.hidden = !strMessage
}

function setKitchenLoginError(strMessage) {
  const elError = document.querySelector('#staffLoginError')
  if (!elError) return
  elError.textContent = strMessage
  elError.hidden = !strMessage
}

function friendlyError(objError) {
  const strCode = objError?.code || ''
  if (strCode.includes('permission-denied')) return 'Firebase security rules rejected this request. Confirm the deployed Firestore rules and staff role.'
  if (strCode.includes('auth/invalid-credential') || strCode.includes('auth/wrong-password') || strCode.includes('auth/user-not-found')) return 'Email or password was not accepted.'
  if (strCode.includes('auth/too-many-requests')) return 'Too many attempts. Wait a little and try again.'
  if (strCode.includes('auth/operation-not-allowed')) return 'Enable Anonymous and Email/Password sign-in providers in Firebase Authentication.'
  if (strCode.includes('unavailable') || strCode.includes('network-request-failed')) return 'The Firebase service could not be reached. Check your internet connection and project settings.'
  return objError?.message || 'Please check Firebase setup and try again.'
}

async function handleAuthChanged(objUser) {
  stopStaffOrderListener()
  clearStaffAccess(false)
  if (!objUser) {
    renderAccessState()
    return
  }
  if (objUser.isAnonymous) {
    renderAccessState()
    return
  }

  try {
    const objStaffSnapshot = await getDoc(doc(firestore, 'staff', objUser.uid))
    if (firebaseAuth.currentUser?.uid !== objUser.uid) return
    const objStaff = objStaffSnapshot.exists() ? objStaffSnapshot.data() : null
    if (!objStaff || objStaff.active !== true || !['kitchen', 'manager'].includes(objStaff.role)) {
      setKitchenLoginError('This Firebase account is not on the active kitchen or manager staff list. Ask the project owner to add your UID to the staff collection.')
      await signOut(firebaseAuth)
      return
    }
    blnKitchenStaff = objStaff.role === 'kitchen'
    blnManager = objStaff.role === 'manager'
    strStaffEmail = objUser.email || 'Signed-in staff'
    if (stopKitchenListener) stopKitchenListener()
    if (blnKitchenStaff) startKitchenListener()
    renderAccessState()
    if (strPendingStaffView && canOpenStaffView(strPendingStaffView)) {
      const strViewId = strPendingStaffView
      strPendingStaffView = null
      showViewRaw(strViewId)
    }
  } catch (objError) {
    if (firebaseAuth.currentUser?.uid !== objUser.uid) return
    setKitchenLoginError(`Staff access could not be checked: ${friendlyError(objError)}`)
    await signOut(firebaseAuth)
  }
}

function clearStaffAccess(stopListener = true) {
  if (stopListener) stopStaffOrderListener()
  blnKitchenStaff = false
  blnManager = false
  strStaffEmail = ''
  arrStaffOrders = []
  renderAccessState()
}

function stopStaffOrderListener() {
  if (stopKitchenListener) stopKitchenListener()
  stopKitchenListener = null
}

function startKitchenListener() {
  stopStaffOrderListener()
  if (!blnFirebaseReady || !blnKitchenStaff) return
  const objOrdersQuery = query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'))
  stopKitchenListener = onSnapshot(objOrdersQuery, (objSnapshot) => {
    arrStaffOrders = objSnapshot.docs.map((objDocument) => mapOrder(objDocument.id, objDocument.data()))
    renderKitchen()
    document.querySelector('#kitchenQueueError').hidden = true
  }, (objError) => {
    document.querySelector('#kitchenQueueError').textContent = `The kitchen queue could not load: ${friendlyError(objError)}`
    document.querySelector('#kitchenQueueError').hidden = false
  })
}

function mapOrder(strDocumentId, objData) {
  const objCreatedAt = objData.createdAt?.toDate ? objData.createdAt.toDate() : null
  return {
    ...objData,
    documentId: strDocumentId,
    id: formatOrderReference(strDocumentId),
    customer: objData.customerName || 'Customer',
    time: objCreatedAt ? objCreatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Just placed'
  }
}

function formatOrderReference(strDocumentId) {
  return `L-${String(strDocumentId).slice(0, 8).toUpperCase()}`
}

function canOpenStaffView(strViewId) {
  if (strViewId === 'kitchenView') return blnKitchenStaff
  if (strViewId === 'managerView') return blnKitchenStaff || blnManager
  return true
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
  document.querySelector('#btnPlaceOrder').disabled = objState.cart.length === 0 || !blnFirebaseReady
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
  saveCart()
  renderCart()
  showNotice('Added to your cart', `${objPizza.name} is in your cart.`, 'success')
}

function addDrinkToCart(elButton) {
  const strDrink = elButton.dataset.drink
  const elSelect = elButton.closest('.drink-card')?.querySelector('select')
  const strSize = elSelect?.value || 'Small'
  objState.cart.push({ name: `${strSize} ${strDrink}`, detail: 'Drink', price: objDrinkPrices[strSize], kind: 'drink' })
  saveCart()
  renderCart()
  showNotice('Added to your cart', `${strSize} ${strDrink} is in your cart.`, 'success')
}

function removeCartItem(intIndex) {
  objState.cart.splice(intIndex, 1)
  saveCart()
  renderCart()
}

function renderReceipt() {
  const elReference = document.querySelector('#receiptReference')
  const elContent = document.querySelector('#trackerContent')
  if (!objLastReceipt) {
    elReference.textContent = 'No recent confirmation'
    elContent.innerHTML = '<p class="empty-cart">Place an order to see its confirmation reference here. Customer pages cannot read order records or status.</p>'
    return
  }
  elReference.textContent = `Order ${objLastReceipt.reference}`
  const strLines = objLastReceipt.items.map((objItem) => `<li>${escapeHtml(objItem.name)}${objItem.detail ? ` · ${escapeHtml(objItem.detail)}` : ''}</li>`).join('')
  elContent.innerHTML = `<div class="receipt-card"><p><strong>Your order was sent to the kitchen.</strong> Keep this reference for pickup or questions.</p><ul>${strLines}</ul><p class="receipt-total">Demo total: ${formatMoney(objLastReceipt.total)} · no payment collected</p><p class="fine-print">This is a confirmation from the information you submitted. The customer page cannot read the stored order or follow its live status.</p></div>`
}

function renderKitchen() {
  const elQueue = document.querySelector('#kitchenQueue')
  const arrOrders = arrStaffOrders
  const intActive = arrOrders.filter((objOrder) => !['Completed', 'Cancelled'].includes(objOrder.status)).length
  document.querySelector('#queueCount').textContent = String(intActive)
  if (!blnKitchenStaff) {
    elQueue.innerHTML = ''
    return
  }
  if (!arrOrders.length) {
    elQueue.innerHTML = '<div class="empty-queue">No tickets yet. New customer orders will appear here when submitted.</div>'
    return
  }
  elQueue.innerHTML = arrOrders.map((objOrder) => {
    const blnComplete = ['Completed', 'Cancelled'].includes(objOrder.status)
    const intStatusIndex = arrStatuses.indexOf(objOrder.status)
    const strNext = intStatusIndex < 0 ? 'Preparing' : arrStatuses[Math.min(intStatusIndex + 1, arrStatuses.length - 1)]
    const strItemLines = Array.isArray(objOrder.items) ? objOrder.items.map((objItem) => `${objItem.name || 'Item'}${objItem.detail ? ` · ${objItem.detail}` : ''}`).join(' | ') : 'Order details unavailable'
    return `<article class="ticket-card ticket-${statusClass(objOrder.status)}"><div class="ticket-top"><strong class="ticket-number">${escapeHtml(objOrder.id)}</strong><span class="ticket-time">${escapeHtml(objOrder.time)}</span></div><span class="ticket-status status-${statusClass(objOrder.status)}">${escapeHtml(objOrder.status)}</span><p class="ticket-customer">${escapeHtml(objOrder.customer)} · ${escapeHtml(objOrder.fulfillment)}${objOrder.tableNumber ? ` · Table ${escapeHtml(objOrder.tableNumber)}` : ''}<br>${escapeHtml(objOrder.customerPhone || '')}</p><p class="ticket-items">${escapeHtml(strItemLines)}</p><div class="ticket-actions">${blnComplete ? '<button class="button button-secondary" type="button" disabled>Ticket closed</button>' : `<button class="button button-primary" type="button" data-advance-order="${escapeHtml(objOrder.documentId)}" aria-label="Advance ${escapeHtml(objOrder.id)} from ${escapeHtml(objOrder.status)} to ${escapeHtml(strNext)}">${objOrder.status === 'Ready' ? 'Mark done' : `Next: ${escapeHtml(strNext)}`}</button>`}</div></article>`
  }).join('')
}

function statusClass(strStatus) {
  return String(strStatus || 'received').toLowerCase().replaceAll(' ', '-')
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

function renderAccessState() {
  const elLoginPanel = document.querySelector('#staffLoginPanel')
  const elWorkspace = document.querySelector('#staffWorkspace')
  if (!elLoginPanel || !elWorkspace) return
  const blnAnyStaff = blnKitchenStaff || blnManager
  elLoginPanel.hidden = blnAnyStaff
  elWorkspace.hidden = !blnAnyStaff
  document.querySelector('#staffIdentity').textContent = blnAnyStaff ? `${strStaffEmail} · ${blnKitchenStaff ? 'Kitchen staff' : 'Manager'}` : ''
  document.querySelector('#kitchenQueue').hidden = !blnKitchenStaff
  document.querySelector('#notKitchenStaff').hidden = !blnManager || blnKitchenStaff
  if (!blnKitchenStaff) document.querySelector('#queueCount').textContent = '0'
  renderKitchen()
}

function renderAll() {
  renderCart()
  renderReceipt()
  renderKitchen()
  renderManagerCharts()
  renderAccessState()
}

function showView(strViewId) {
  if ((strViewId === 'kitchenView' || strViewId === 'managerView') && !canOpenStaffView(strViewId)) {
    strPendingStaffView = strViewId
    showViewRaw('kitchenView')
    if (!blnFirebaseReady) setKitchenLoginError('Firebase is not configured yet. Ask the project owner to finish the setup described in README.md.')
    return
  }
  strPendingStaffView = null
  showViewRaw(strViewId)
}

function showViewRaw(strViewId) {
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

function validateCheckout() {
  const elName = document.querySelector('#txtCustomerName')
  const elPhone = document.querySelector('#txtCustomerPhone')
  const elEmail = document.querySelector('#txtCustomerEmail')
  const strName = elName.value.trim()
  const strPhone = elPhone.value.trim()
  const strEmail = elEmail.value.trim()
  const strTableNumber = strFulfillment === 'Dine-in' ? document.querySelector('#txtTableNumber').value.trim() : ''
  let elInvalid = null
  let strMessage = ''
  for (const elInput of [elName, elPhone, elEmail]) elInput.removeAttribute('aria-invalid')
  if (!strName || strName.length > 80) {
    strMessage = 'Enter your name (up to 80 characters) so the team knows who to call.'
    elInvalid = elName
  } else if (!strPhone || strPhone.length > 30) {
    strMessage = 'Enter a phone number up to 30 characters for your order.'
    elInvalid = elPhone
  } else if (strEmail && (!regEmail.test(strEmail) || strEmail.length > 254)) {
    strMessage = 'Enter a valid email address or leave it blank.'
    elInvalid = elEmail
  } else if (strTableNumber.length > 10) {
    strMessage = 'Table number must be 10 characters or fewer.'
    elInvalid = document.querySelector('#txtTableNumber')
  } else if (!objState.cart.length || objState.cart.length > 20) {
    strMessage = 'Your order must include between 1 and 20 items.'
  }
  if (strMessage) {
    const elError = document.querySelector('#checkoutError')
    elError.textContent = strMessage
    elError.hidden = false
    elInvalid?.setAttribute('aria-invalid', 'true')
    elInvalid?.focus()
    return null
  }
  document.querySelector('#checkoutError').hidden = true
  return { customerName: strName, customerPhone: strPhone, customerEmail: strEmail, fulfillment: strFulfillment, tableNumber: strTableNumber }
}

async function handleCheckoutSubmit(event) {
  event.preventDefault()
  if (!blnFirebaseReady) {
    setFirebaseNotice('Set up Firebase using the steps in README.md before placing an order.')
    return
  }
  const objCustomer = validateCheckout()
  if (!objCustomer) return
  const elSubmit = document.querySelector('#btnPlaceOrder')
  elSubmit.disabled = true
  elSubmit.textContent = 'Sending order…'
  try {
    let objUser = firebaseAuth.currentUser
    if (objUser && !objUser.isAnonymous) throw new Error('A staff account is signed in. Sign out from the Kitchen page before placing a customer order.')
    if (!objUser) {
      const objCredential = await signInAnonymously(firebaseAuth)
      objUser = objCredential.user
    }
    const arrItems = objState.cart.map((objItem) => ({
      name: String(objItem.name).slice(0, 100),
      detail: String(objItem.detail || '').slice(0, 180),
      price: Number(objItem.price),
      kind: objItem.kind === 'pizza' ? 'pizza' : 'drink'
    }))
    const intTotal = arrItems.reduce((numSum, objItem) => numSum + objItem.price, 0)
    const objOrderData = {
      ...objCustomer,
      items: arrItems,
      total: intTotal,
      status: 'Received',
      createdBy: objUser.uid,
      createdAt: serverTimestamp()
    }
    const objOrderRef = await addDoc(collection(firestore, 'orders'), objOrderData)
    objLastReceipt = { reference: formatOrderReference(objOrderRef.id), fulfillment: objCustomer.fulfillment, items: arrItems, total: intTotal }
    objState.cart = []
    saveCart()
    renderCart()
    renderReceipt()
    document.querySelector('#checkoutStage').hidden = true
    document.querySelector('#builderStage').hidden = false
    document.querySelector('#checkoutForm').reset()
    document.querySelector('#txtTableNumber').value = ''
    showView('trackingView')
    showNotice('Demo order placed', `Order ${objLastReceipt.reference} was sent to the kitchen. No payment was collected.`, 'success')
  } catch (objError) {
    const elError = document.querySelector('#checkoutError')
    elError.textContent = `Order could not be sent: ${friendlyError(objError)}`
    elError.hidden = false
  } finally {
    elSubmit.textContent = 'Place demo order'
    elSubmit.disabled = objState.cart.length === 0 || !blnFirebaseReady
  }
}

async function advanceOrder(strDocumentId) {
  if (!blnKitchenStaff) return
  const objOrder = arrStaffOrders.find((objCandidate) => objCandidate.documentId === strDocumentId)
  if (!objOrder) return
  const intCurrentIndex = arrStatuses.indexOf(objOrder.status)
  if (intCurrentIndex < 0 || intCurrentIndex >= arrStatuses.length - 1) return
  try {
    await updateDoc(doc(firestore, 'orders', strDocumentId), { status: arrStatuses[intCurrentIndex + 1], updatedAt: serverTimestamp() })
  } catch (objError) {
    showNotice('Ticket not updated', friendlyError(objError), 'error')
  }
}

async function handleStaffLogin(event) {
  event.preventDefault()
  if (!blnFirebaseReady) {
    setKitchenLoginError('Firebase is not configured yet. Finish the setup described in README.md.')
    return
  }
  const elEmail = document.querySelector('#staffEmail')
  const elPassword = document.querySelector('#staffPassword')
  const elButton = document.querySelector('#btnStaffLogin')
  const strEmail = elEmail.value.trim()
  if (!strEmail || !elPassword.value) return
  elButton.disabled = true
  setKitchenLoginError('Signing in and checking your staff role…')
  try {
    await signInWithEmailAndPassword(firebaseAuth, strEmail, elPassword.value)
  } catch (objError) {
    setKitchenLoginError(`Sign in failed: ${friendlyError(objError)}`)
  } finally {
    elButton.disabled = false
  }
}

async function handleStaffSignOut() {
  if (!firebaseAuth) return
  stopStaffOrderListener()
  await signOut(firebaseAuth)
  setKitchenLoginError('You are signed out.')
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
    saveCart()
    renderCart()
  })
  document.querySelector('#btnCheckout').addEventListener('click', openCheckout)
  document.querySelector('#btnBackToOrder').addEventListener('click', backToOrder)
  document.querySelector('#checkoutForm').addEventListener('submit', handleCheckoutSubmit)
  document.querySelector('#checkoutForm').addEventListener('input', () => {
    document.querySelector('#checkoutError').hidden = true
    document.querySelectorAll('#checkoutForm [aria-invalid="true"]').forEach((elInput) => elInput.removeAttribute('aria-invalid'))
  })
  document.querySelector('#staffLoginForm').addEventListener('submit', handleStaffLogin)
  document.querySelector('#btnStaffSignOut').addEventListener('click', handleStaffSignOut)
  document.querySelector('#kitchenQueue').addEventListener('click', (event) => {
    const elAdvanceButton = event.target.closest('[data-advance-order]')
    if (elAdvanceButton) advanceOrder(elAdvanceButton.dataset.advanceOrder)
  })
  updatePizzaPreview()
  renderAll()
  setupFirebase()
}

document.addEventListener('DOMContentLoaded', init)
