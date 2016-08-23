/** @module tinier-dom */

// constants
export const BINDING = '@TINIER_BINDING'
export const ELEMENT = '@TINIER_ELEMENT'

// functions
function partial (fn, arg) {
  return (...args) => fn(arg, ...args)
}

function keyBy (arr, key) {
  var obj = {}
  arr.map(x => obj[x[key]] = x)
  return obj
}

function mapValues (obj, fn) {
  const newObj = {}
  for (let key in obj) {
    newObj[key] = fn(obj[key], key)
  }
  return newObj
}

export function addressToObj (address, val) {
  if (address.length === 0)
    return val
  const f = address[0]
  if (isString(f)) {
    return { [f]: addressToObj(address.slice(1), val) }
  } else {
    const ar = Array(f)
    ar[f] = addressToObj(address.slice(1), val)
    return ar
  }
}

function mergeBindingsArray (bindings) {
  return bindings.reduce((acc, binding) => {
    if (!isArray(binding))
      throw Error('Incompatible bindings: mix of types')
    for (let i = 0, l = binding.length; i < l; i++) {
      if (binding[i]) {
        if (acc[i])
          acc[i] = mergeBindings([ binding[i], acc[i] ])
        else
          acc[i] = binding[i]
      }
    }
    return acc
  }, [])
}

function mergeBindingsObject (bindings) {
  return bindings.reduce((acc, binding) => {
    if (isArray(binding))
      throw Error('Incompatible bindings: mix of types')
    for (let k in binding) {
      if (binding[k]) {
        if (acc[k])
          acc[k] = mergeBindings([ binding[k], acc[k] ])
        else
          acc[k] = binding[k]
      }
    }
    return acc
  }, {})
}

export function mergeBindings (bindings) {
  return isArray(bindings[0]) ?
    mergeBindingsArray(bindings) :
    mergeBindingsObject(bindings)
}

function tagType (obj, type) {
  return Object.assign({}, obj, { type })
}

// TODO share a dependency with tinier
// Make sure default is null so undefined type constant do not match
const checkType = (type, obj) => obj && obj.type && obj.type === type
const isTinierBinding = partial(checkType, BINDING)
const isTinierElement = partial(checkType, ELEMENT)
const isElement = v => v instanceof Element
const isArray = Array.isArray
const isString = v => typeof v === 'string'

/**
 * Create a new TinierDOM element.
 * @param {String} tagName
 * @param {Object|null} attributes = {} - The attributes. Note that JSX will
 * pass null in when there are no attributes. In the resulting object, this will
 * be an empty object {}.
 * @param {Object[]|Object|String} ...childrenAr - A single binding or a mix of
 * elements and strings.
 * @return {Object} A TinierDOM element.
 */
export function h (tagName, attributes = {}, ...childrenAr) {
  if (!attributes) attributes = {}
  const children = isTinierBinding(childrenAr[0]) ? childrenAr[0] : childrenAr
  return tagType({ tagName, attributes, children }, ELEMENT)
}

/**
 * Create a new TinierDOM binding.
 * @param {Array} address - An address array.
 * @return {Object} A TinierDOM binding.
 */
export function binding (address) {
  return tagType({ address }, BINDING)
}

function createDOMElement (tinierEl) {
  return updateDOMElement(document.createElement(tinierEl.tagName), tinierEl)
}

export function getStyles (cssText) {
  const reg = /([^:; ]+):/g
  const res = []
  let ar
  while ((ar = reg.exec(cssText)) !== null) {
    res.push(ar[1])
  }
  return res
}

function toCamelCase (name) {
  return name
  // Uppercase the first character in each group immediately following a dash
    .replace(/-(.)/g, m => m.toUpperCase())
  // Remove dashes
    .replace(/-/g, '')
}

function stripOn (name) {
  return name.slice(2).toLowerCase()
}

export function updateDOMElement (el, tinierEl) {
  mapValues(tinierEl.attributes, (v, k) => {
    if (k === 'id') {
      el.id = v
    } else if (k === 'style' && !isString(v)) {
      mapValues(v, (sv, sk) => {
        el.style.setProperty(sk, sv)
      })
    } else if (k.indexOf('on') === 0) {
      el['__tinier_' + k] = v
      el.addEventListener(stripOn(k), v)
    } else {
      el.setAttribute(k, v)
    }
  })
  // delete attributes if not provided
  Object.keys(el.attributes)
    .filter(k => !(k in tinierEl.attributes))
    .map(k => {
      if (k.indexOf('on') === 0)
        el.removeEventListener(stripOn(k), el['__tinier_' + k])
      else
        el.removeAttribute(k)
    })
  // delete styles if not provided
  const tStyle = tinierEl.attributes.style
  if (tStyle && !isString(tStyle)) {
    getStyles(el.style.cssText)
      .filter(a => !(a in tStyle || toCamelCase(a) in tStyle))
      .map(a => el.style.removeProperty(a))
  }
  return el
}

/**
 * Deal with possible children values.
 * @param {Object[]|Object|String} children
 * @return {Object[]} An array of children to render.
 */
function renderChildren (el, children) {
if (isTinierBinding(children)) {
    return addressToObj(children.address, el)
  } else if (isArray(children)) {
    return render(el, ...children)
  } else { // Tinier element
    throw Error('Unrecognized type for children')
  }
}

/**
 * Render the given element tree into the container.
 * @param {Element} container - A DOM element that will be the container for
 * the renedered element tree.
 * @param {...[Object|String]|Object|String} tinierElements - Any number of
 * TinierDOM elements or strings that will be rendered.
 * @return {Object} A nested data structure of bindings for use in Tinier.
 */
export function render (container, ...tinierElementsAr) {
  // check arguments
  if (!isElement(container))
    throw Error('First argument must be a DOM Element.')
  const tinierElements = tinierElementsAr.reduce((acc, el) => {
    if (isArray(el)) return [ ...acc, ...el ]
    else             return [ ...acc,    el ]
  }, [])
  tinierElements.map(e => {
    if (!isTinierElement(e) && !isString(e))
      throw Error('All arguments except the first must be TinierDOM elements or strings.')
  })

  // get the children with IDs
  const childrenWithKeys = Array.from(container.children).filter(c => c.id)
  const elementsByID = keyBy(childrenWithKeys, 'id')

  const bindings = tinierElements.map((tinierEl, i) => {
    // container.childNodes is a live collection, so get the current node at this
    // index
    const el = container.childNodes[i]
    if (isString(tinierEl)) {
      // if string
      if (el instanceof Text) {
        // already a text node, then set the text content
        el.textContent = tinierEl
      } else if (el) {
        // not a text node, then replace it
        container.replaceChild(document.createTextNode(tinierEl), el)
      } else {
        // no existing node, then add a new one
        container.appendChild(document.createTextNode(tinierEl))
      }
      return null
    } else if (isTinierElement(tinierEl)) {
      // tinierEl and el exist, then check for a matching node by ID
      if (tinierEl.attributes.id in elementsByID) {
        // matching ID element
        const movedEl = elementsByID[tinierEl.attributes.id]
        if (el) {
          // if match and existing el, then replace the element
          container.replaceChild(movedEl, el)
        } else {
          // if match and el is undefined, then append the element
          container.appendChild(movedEl)
        }
        // then render children
        return renderChildren(movedEl, tinierEl.children)
      } else if (el) {
        // both defined, check type and id
        if (el.tagName && el.tagName.toLowerCase() === tinierEl.tagName.toLowerCase()) {
          // matching tag, then update the node to match. Be aware that existing
          // nodes with IDs might get moved, so we should clone them?
          const elToUpdate = el.id ? el.cloneNode(true) : el
          updateDOMElement(elToUpdate, tinierEl)
          if (el.id) container.replaceChild(elToUpdate, el)
          return renderChildren(elToUpdate, tinierEl.children)
        } else {
          // not a matching tag, then replace the element with a new one
          const newEl = createDOMElement(tinierEl)
          container.replaceChild(newEl, el)
          return renderChildren(newEl, tinierEl.children)
        }
      } else {
        // no el and no ID match, then add a new Element or string node
        const newEl2 = createDOMElement(tinierEl)
        container.appendChild(newEl2)
        return renderChildren(newEl2, tinierEl.children)
      }
    } else {
      // no tinierEl, then remove the el, if it exists
      if (el) container.removeChild(el)
      return null
    }
  })

  // remove extra nodes
  Array.prototype.slice.call(container.childNodes, tinierElements.length)
    .map(c => container.removeChild(c))

  // merge the bindings
  return mergeBindings(bindings.filter(b => b !== null))
}
