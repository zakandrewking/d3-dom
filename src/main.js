'use strict'

import { zipWith, partial, get, set, merge, filter, keyBy, mapValues, } from 'lodash'

export const BINDING = '@TINIER_BINDING'
export const ELEMENT = '@TINIER_ELEMENT'

function tagType (obj, type) {
  return Object.assign({}, obj, { type })
}

// TODO share a dependency with tinier
// Make sure default is null so undefined type constant do not match
const checkType = (type, obj) => get(obj, 'type', null) === type
const isTinierBinding = partial(checkType, BINDING)
const isTinierElement = partial(checkType, ELEMENT)
const isElement = v => v instanceof Element
const isArray = Array.isArray
const isString = v => typeof v === 'string'

/**
 * Create a new TinierDOM element.
 * @param {String} tagName
 * @param {Object} attributes = {}
 * @param {Object[]|Object|String} ...childrenAr - A single binding or a mix of
 * elements and strings.
 * @return {Object} A TinierDOM element.
 */
export function h (tagName, attributes = {}, ...childrenAr) {
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

function updateDOMElement (el, tinierEl) {
  mapValues(tinierEl.attributes, (v, k) => {
    if (k === 'id') {
      el.id = v
    } else if (k === 'style' && !isString(v)) {
      mapValues(v, (sv, sk) => {
        el.style.setProperty(sk, sv)
      })
    } else {
      el.setAttribute(k, v)
    }
  })
  return el
}

/**
 * Deal with possible children values.
 * @param {Object[]|Object|String} children
 * @return {Object[]} An array of children to render.
 */
function renderChildren (el, children) {
if (isTinierBinding(children)) {
    return set({}, children.address, el)
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
 * @param {...Object|String} tinierElements - Any number of TinierDOM elements
 * or strings that will be rendered.
 * @return {Object} A nested data structure of bindings for use in Tinier.
 */
export function render (container, ...tinierElements) {
  // check arguments
  if (!isElement(container))
    throw Error('First argument must be a DOM Element.')
  tinierElements.map(e => {
    if (!isTinierElement(e) && !isString(e))
      throw Error('All arguments except the first must be TinierDOM elements or strings.')
  })

  // get the children with IDs
  const childrenWithKeys = filter(container.children, c => c.id)
  const elementsByID = keyBy(childrenWithKeys, c => c.id)

  const bindings = zipWith(Array.from(container.children), tinierElements, (el, tinierEl) => {
    if (tinierEl) {
      // tinierEl and el exist, then check for a matching node by ID
      if (tinierEl.id && tinierEl.id in elementsByID) {
        // matching ID element
        const movedEl = elementsByID[el.id]
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
        if (el.tagName && el.tagName === tinierEl.tagName) {
          // matching tag, then update the node to match. Be aware that existing
          // nodes with IDs might get moved, so we should clone them?
          const elToUpdate = el.id ? el.cloneNode(true) : el
          updateDOMElement(elToUpdate, tinierEl)
          if (el.id) container.replaceChild(elToUpdate, el)
          return renderChildren(elToUpdate, tinierEl.children)
        } else if (isTinierElement(tinierEl)) {
          // not a matching tag, then replace the element with a new one
          const newEl = createDOMElement(tinierEl)
          container.replaceChild(newEl, el)
          return renderChildren(newEl, tinierEl.children)
        } else if (isString(tinierEl)) {
          // text
          container.appendChild(document.createTextNode(tinierEl))
          return null
        }
      } else {
        // no el and no ID match, then add a new Element or string node
        if (isTinierElement(tinierEl)) {
          // tinier element
          const newEl = createDOMElement(tinierEl)
          container.appendChild(newEl)
          return renderChildren(newEl, tinierEl.children)
        } else {
          // text
          container.appendChild(document.createTextNode(tinierEl))
          return null
        }
      }
    } else {
      // no tinierEl, then remove the el, if it exists
      if (el) container.removeChild(el)
      return null
    }
    // just in case
    return null
  })

  // merge the bindings
  return merge({}, ...bindings)
}
