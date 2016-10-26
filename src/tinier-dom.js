/** @module tinier-dom */

import {
  mapValues, isFunction, isUndefined, tagType, checkType, isArray, isString,
  notNull, get,
} from 'tinier'

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
const ATTRIBUTE_RENAME = {}
const ATTRIBUTE_RENAME_REV = reverseObject(ATTRIBUTE_RENAME)
const ATTRIBUTE_APPLY = {
  checked: (el, name, val = false) => {
    if (name !== 'input') {
      throw new Error('"checked" attribute is only supported on input elements.')
    }
    el.checked = val
  },
  value: (el, name, val = false) => {
    if ([ 'input', 'textarea' ].indexOf(name) === -1) {
      throw new Error('"value" attribute is only supported on input and ' +
                      'textarea elements.')
    }
    el.value = val
  },
}

// namespace management inspired by of D3.js, Mike Bostock, BSD license
const NAMESPACES = {
  svg: 'http://www.w3.org/2000/svg',
  xhtml: 'http://www.w3.org/1999/xhtml',
  xlink: 'http://www.w3.org/1999/xlink',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xmlns: 'http://www.w3.org/2000/xmlns/',
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

/**
 *
 */
export function addressToObj (address, val) {
  // If address is []
  if (isUndefined(address[0])) {
    return val
  }
  const f = address[0]
  if (isString(f)) {
    return { [f]: addressToObj(address.slice(1), val) }
  } else {
    const ar = Array(f + 1)
    ar[f] = addressToObj(address.slice(1), val)
    return ar
  }
}

function objectForBindingsArray (bindings) {
  // Check arrays and find longest internal array.
  let longest = 0
  for (let j = 0, l = bindings.length; j < l; j++) {
    const binding = bindings[j]
    if (!isArray(binding)) {
      throw Error('Incompatible bindings: mix of types')
    }
    const len = binding.length
    if (len > longest) {
      longest = len
    }
  }
  const acc = []
  for (let i = 0; i < longest; i++) {
    for (let j = 0, l = bindings.length; j < l; j++) {
      const binding = bindings[j]
      if (binding[i] != null) { // not null or undefined
        if (acc[i] != null) { // not null or undefined
          acc[i] = objectForBindings([ binding[i], acc[i] ])
        } else {
          acc[i] = binding[i]
        }
      }
    }
  }
  return acc
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

// TODO share a dependency with tinier
// Make sure default is null so undefined type constant do not match
const isTinierBinding = obj => checkType(BINDING, obj)
const isTinierElement = obj => checkType(ELEMENT, obj)
const isElement = v => v instanceof Element

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
  return tagType(ELEMENT, { tagName, attributes, children })
}

/**
 * Create a new TinierDOM binding.
 * @param {Array|String|Number} addressIn - An address array, or single key or
 *                                          index.
 * @return {Object} A TinierDOM binding.
 */
export function bind (addressIn) {
  const address = isArray(addressIn) ? addressIn : [ addressIn ]
  return tagType(BINDING, { address })
}

function explicitNamespace (name) {
  const i = name.indexOf(':')
  if (i !== -1) {
    const prefix = name.slice(0, i)
    if (prefix in NAMESPACES) {
      // for xmlns, treat the whole name (e.g. xmlns:xlink) as the name
      const newName = prefix === 'xmlns' ? name : name.slice(i + 1)
      return { name: newName, explicit: NAMESPACES[prefix] }
    } else {
      return { name, explicit: null }
    }
  } else {
    return { name, explicit: null }
  }
}

/**
 * Create a DOM element, inheriting namespace or choosing one based on tag.
 * @param {Object} tinierEl - A TinierDOM element.
 * @param {Object} parent - The parent el.
 * @return {Object} The DOM element.
 */
export function createDOMElement (tinierEl, parent) {
  const tag = tinierEl.tagName
  const { name, explicit } = explicitNamespace(tag)
  const ns = (explicit !== null ? explicit :
              (tag in NAMESPACES ? NAMESPACES[tag] : parent.namespaceURI))
  const el = document.createElementNS(ns, name)
  return updateDOMElement(el, tinierEl)
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

function setAttributeCheckBool (namespace, el, name, val) {
  if (val === true) {
    el.setAttributeNS(namespace, name, name)
  } else if (val !== false) {
    el.setAttributeNS(namespace, name, val)
  }
}

/**
 * Update the DOM element to match a TinierDOM element.
 * @param {Element} el - An existing DOM element.
 * @param {Object} tinierEl - A TinierDOM element.
 */
export function updateDOMElement (el, tinierEl) {
  let thenFn = null
  const parentNamespace = el.namespaceURI

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
      if (!el.hasOwnProperty(LISTENER_OBJECT)) {
        el[LISTENER_OBJECT] = {}
      }
      // allow null
      if (v !== null) {
        const name = stripOn(k)
        if (!isFunction(v) && v !== null) {
          throw new Error(v + ' is not a function.')
        }
        el[LISTENER_OBJECT][name] = v
        el.addEventListener(name, v)
      }
    } else if (k in ATTRIBUTE_RENAME) {
      // By default, set the attribute.
      const { name, explicit } = explicitNamespace(k)
      setAttributeCheckBool(explicit !== null ? explicit : parentNamespace,
                            el, ATTRIBUTE_RENAME[explicit], v)
    } else if (k in ATTRIBUTE_APPLY) {
      ATTRIBUTE_APPLY[k](el, tinierEl.tagName, v)

    } else if (k === 'then') {
      if (v !== null) {
        if (!isFunction(v)) {
          throw new Error(v + ' is not a function or null.')
        }
        thenFn = v
      }
    } else {
      // By default, set the attribute.
      const { name, explicit } = explicitNamespace(k)
      setAttributeCheckBool(explicit !== null ? explicit : parentNamespace,
                            el, name, v)
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
      } else if (k in ATTRIBUTE_APPLY) {
        ATTRIBUTE_APPLY[k](el, tinierEl.tagName)
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

  // call the callback
  if (thenFn) {
    thenFn(el)
  }

  return el
}

/**
* flatten the elements array
*/
function flattenElementsAr (ar) {
  return ar.reduce((acc, el) => {
    return isArray(el) ? [ ...acc, ...el ] : [ ...acc, el ]
  }, []).filter(notNull) // null means ignore
}

function removeExtraNodes (container, length) {
  for (let i = container.childNodes.length - 1; i >= length; i--) {
    container.removeChild(container.childNodes[i])
  }
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

  const tinierElements = flattenElementsAr(tinierElementsAr)

  const first = get(tinierElements, 0)
  if (isTinierBinding(first)) {
    if (tinierElements.length !== 1) {
      throw new Error('A binding cannot have siblings in TinierDOM. ' +
                      'At binding: [ ' + first.address.join(', ') + ' ].')
    }
    return objectForBindings([ addressToObj(first.address, container) ])
  }

  // get the children with IDs
  const childrenWithKeys = Array.from(container.children).filter(c => c.id)
  const elementsByID = keyBy(childrenWithKeys, 'id')

  // render each element
  const bindingsAr = tinierElements.map((tinierEl, i) => {
    // If an element if a binding, then there can only be one child.
    if (isUndefined(tinierEl)) {
      // cannot be undefined
      throw new Error('Children in Tinier Elements cannot be undefined.')
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
          const newEl = createDOMElement(tinierEl, container)
          container.replaceChild(newEl, el)
          return render(newEl, ...tinierEl.children)
        }
      } else {
        // no el and no ID match, then add a new Element or string node
        const newEl2 = createDOMElement(tinierEl, container)
        container.appendChild(newEl2)
        return render(newEl2, ...tinierEl.children)
      }
      // There should not be any bindings here
    } else if (isTinierBinding(tinierEl)) {
      throw new Error('A binding cannot have siblings in TinierDOM. ' +
                      'At binding: [ ' + tinierEl.address.join(', ') + ' ].')
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
  // TODO This should not run if the child is a binding. Make a test for
  // this. When else should it not run?
  removeExtraNodes(container, tinierElements.length)

  // bindings array to object
  return objectForBindings(bindingsAr.filter(b => b !== null))
}
