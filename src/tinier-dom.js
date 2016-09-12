/** @module tinier-dom */

// constants
export const BINDING = '@TINIER_BINDING'
export const ELEMENT = '@TINIER_ELEMENT'
const LISTENER_OBJECT = '@TINIER_LISTENERS'

function reverseObject (obj) {
  const newObj = {}
  for (let k in obj) {
    newObj[obj[k]] = k
  }
  return newObj
}

// some attribute renaming as seen in React
const ATTRIBUTE_RENAME = { className: 'class', htmlFor: 'for' }
const ATTRIBUTE_RENAME_REV = reverseObject(ATTRIBUTE_RENAME)

// functions
function partial (fn, arg) {
  return (...args) => fn(arg, ...args)
}

/**
 * Check if the object is a function.
 * @param {*} object - The object to test.
 * @return {Boolean}
 */
export function isFunction (object) {
  return typeof(object) === 'function'
}

/**
 * Turn an array of objects into a new object of objects where the keys are
 * given by the value of `key` in each child object.
 * @param {[Object]} arr - The array of objects.
 * @param {String} key - The key to look for.
 */
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

/**
 *
 */
export function addressToObj (address, val) {
  if (address.length === 0) {
    return val
  }
  const f = address[0]
  if (isString(f)) {
    return { [f]: addressToObj(address.slice(1), val) }
  } else {
    const ar = Array(f)
    ar[f] = addressToObj(address.slice(1), val)
    return ar
  }
}

function objectForBindingsArray (bindings) {
  return bindings.reduce((acc, binding) => {
    if (!isArray(binding)) {
      throw Error('Incompatible bindings: mix of types')
    }
    for (let i = 0, l = binding.length; i < l; i++) {
      if (binding[i]) {
        if (acc[i]) {
          acc[i] = objectForBindings([ binding[i], acc[i] ])
        } else {
          acc[i] = binding[i]
        }
      }
    }
    return acc
  }, [])
}

function objectForBindingsObject (bindings) {
  return bindings.reduce((acc, binding) => {
    if (isArray(binding))
      throw Error('Incompatible bindings: mix of types')
    for (let k in binding) {
      if (binding[k]) {
        if (acc[k]) {
          acc[k] = objectForBindings([ binding[k], acc[k] ])
        } else {
          acc[k] = binding[k]
        }
      }
    }
    return acc
  }, {})
}

export function objectForBindings (bindings) {
  return isArray(bindings[0]) ?
    objectForBindingsArray(bindings) :
    objectForBindingsObject(bindings)
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
 * @param {String} tagName - The name for the element.
 * @param {Object|null} attributesIn - The attributes. Note that JSX will pass
 *                                     null in when there are no attributes. In
 *                                     the resulting object, this will be an
 *                                     empty object {}.
 * @param {Object[]|Object|String} ...children - A single binding or a mix of
 *                                               elements and strings.
 * @return {Object} A TinierDOM element.
 */
export function h (tagName, attributesIn, ...children) {
  const attributes = attributesIn == null ? {} : attributesIn
  return tagType({ tagName, attributes, children }, ELEMENT)
}

/**
 * Create a new TinierDOM binding.
 * @param {Array|String|Number} addressIn - An address array, or single key or
 *                                          index.
 * @return {Object} A TinierDOM binding.
 */
export function bind (addressIn) {
  const address = isArray(addressIn) ? addressIn : [ addressIn ]
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

function setAttributeCheckBool (el, name, val) {
  if (val === true) {
    el.setAttribute(name, name)
  } else if (val !== false) {
    el.setAttribute(name, val)
  }
}

/**
 * Update the DOM element to match a TinierDOM element.
 * @param {Element} el - An existing DOM element.
 * @param {Object} tinierEl - A TinierDOM element.
 */
export function updateDOMElement (el, tinierEl) {
  // remove event listeners first, because they cannot simply be replaced
  if (el.hasOwnProperty(LISTENER_OBJECT)) {
    mapValues(el[LISTENER_OBJECT], (onFn, name) => {
      el.removeEventListener(name, onFn)
    })
    delete el[LISTENER_OBJECT]
  }

  // Update the attributes.
  // TODO is it faster to check first, or set first?
  mapValues(tinierEl.attributes, (v, k) => {
    if (k === 'id') {
      // ID is set directly
      el.id = v
    } else if (k === 'style' && !isString(v)) {
      // For a style object. For a style string, use setAttribute below.
      mapValues(v, (sv, sk) => {
        el.style.setProperty(sk, sv)
      })
    } else if (k.indexOf('on') === 0) {
      // Special handling for listeners
      if (!el.hasOwnProperty(LISTENER_OBJECT)) el[LISTENER_OBJECT] = {}
      const name = stripOn(k)
      if (!isFunction(v)) {
        throw new Error(v + ' is not a function.')
      }
      el[LISTENER_OBJECT][name] = v
      el.addEventListener(name, v)
    } else if (k in ATTRIBUTE_RENAME) {
      // By default, set the attribute.
      setAttributeCheckBool(el, ATTRIBUTE_RENAME[k], v)
    } else {
      // By default, set the attribute.
      setAttributeCheckBool(el, k, v)
    }
  })
  // Delete attributes if not provided. First, loop through this attributes
  // object to get a nice array.
  let attributeNames = []
  for (let i = 0, l = el.attributes.length; i < l; i++) {
    attributeNames.push(el.attributes[i].name)
  }
  attributeNames
    .filter(k => !(k in tinierEl.attributes) || tinierEl.attributes[k] === false)
    .map(k => {
      if (k in ATTRIBUTE_RENAME_REV) {
        el.removeAttribute(ATTRIBUTE_RENAME_REV[k])
      } else {
        el.removeAttribute(k)
      }
    })
  // Delete styles if not provided.
  const tStyle = tinierEl.attributes.style
  if (tStyle && !isString(tStyle)) {
    getStyles(el.style.cssText)
      .filter(a => !(a in tStyle || toCamelCase(a) in tStyle))
      .map(a => el.style.removeProperty(a))
  }
  return el
}

/**
 * Render the given element tree into the container.
 * @param {Element} container - A DOM element that will be the container for
 *                              the renedered element tree.
 * @param {...[Object|String]|Object|String} tinierElementsAr -
 *   Any number of TinierDOM elements or strings that will be rendered.
 * @return {Object} A nested data structure of bindings for use in Tinier.
 */
export function render (container, ...tinierElementsAr) {
  // check arguments
  if (!isElement(container)) {
    throw new Error('First argument must be a DOM Element.')
  }

  const tinierElements = tinierElementsAr
          // flatten the elements array
          .reduce((acc, el) => {
            return isArray(el) ? [ ...acc, ...el ] : [ ...acc, el ]
          }, [])
          // null means ignore
          .filter(n => n !== null)

  // get the children with IDs
  const childrenWithKeys = Array.from(container.children).filter(c => c.id)
  const elementsByID = keyBy(childrenWithKeys, 'id')

  // render each element
  const bindingsAr = tinierElements.map((tinierEl, i) => {
    // If an element if a binding, then there can only be one child.
    if (isTinierBinding(tinierEl)) {
      if (tinierElements.length !== 1) {
        throw new Error('A binding cannot have siblings in TinierDOM. ' +
                        'At binding: [ ' + tinierEl.address.join(', ') + ' ].')
      }
      return addressToObj(tinierEl.address, container)
    } else if (isTinierElement(tinierEl)) {
      // container.childNodes is a live collection, so get the current node at
      // this index.
      const el = container.childNodes[i]
      // tinierEl is a TinierDOM element.
      if (tinierEl.attributes.id in elementsByID) {
        // el exist, then check for a matching node by ID
        const movedEl = elementsByID[tinierEl.attributes.id]
        if (el) {
          // if match and existing el, then replace the element
          container.replaceChild(movedEl, el)
        } else {
          // if match and el is undefined, then append the element
          container.appendChild(movedEl)
        }
        // then render children
        return render(movedEl, ...tinierEl.children)
      } else if (el) {
        // both defined, check type and id
        if (el.tagName && el.tagName.toLowerCase() ===
            tinierEl.tagName.toLowerCase()) {
          // matching tag, then update the node to match. Be aware that existing
          // nodes with IDs might get moved, so we should clone them?
          const elToUpdate = el.id ? el.cloneNode(true) : el
          updateDOMElement(elToUpdate, tinierEl)
          if (el.id) container.replaceChild(elToUpdate, el)
          return render(elToUpdate, ...tinierEl.children)
        } else {
          // not a matching tag, then replace the element with a new one
          const newEl = createDOMElement(tinierEl)
          container.replaceChild(newEl, el)
          return render(newEl, ...tinierEl.children)
        }
      } else {
        // no el and no ID match, then add a new Element or string node
        const newEl2 = createDOMElement(tinierEl)
        container.appendChild(newEl2)
        return render(newEl2, ...tinierEl.children)
      }
    } else {
      const el = container.childNodes[i]
      const s = String(tinierEl)
      // This should be a text node.
      if (el instanceof Text) {
        // If already a text node, then set the text content.
        el.textContent = s
      } else if (el) {
        // If not a text node, then replace it.
        container.replaceChild(document.createTextNode(s), el)
      } else {
        // If no existing node, then add a new one.
        container.appendChild(document.createTextNode(s))
      }
      // No binding here.
      return null
    }
  })

  // remove extra nodes
  Array.prototype.slice.call(container.childNodes, tinierElements.length)
    .map(c => container.removeChild(c))

  // bindings array to object
  return objectForBindings(bindingsAr.filter(b => b !== null))
}
