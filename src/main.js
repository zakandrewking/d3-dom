'use strict'

import d3 from 'd3'
import { curry, get, merge, set, } from 'lodash'

export const D3Binding = '@D3Binding'
export const D3Element = '@D3Element'

// TODO share a dependency with tinier
// Make sure default is null so undefined type constant do not match
const checkType = curry((type, obj) => get(obj, 'type', null) === type)
const isArray = Array.isArray
const isString = v => typeof v === 'string'
const isD3Binding = checkType(D3Binding)
const isD3Element = checkType(D3Element)

/**
 * @param {String} tagName
 * @param {Object} attributes = {}
 * @param {D3Element[]|D3Element|D3Binding|String|null} children = null
 * @return {D3Element}
 */
export function h (tagName, attributes = {}, children = null) {
  return { tagName, attributes, children, type: D3Element }
}

/**
 * Update a selection or create a new element with the given attributes.
 * @param {Selection} parentSel
 * @param {String} tagName
 * @param {Object} attributes
 * @return {Selection} D3 selection of the new or updated element.
 */
function appendOrUpdate (parentSel, tagName, attributes) {
  debugger
  let sel = parentSel.select(tagName)
  if (sel.empty())
    sel = parentSel.append(tagName)
  for (let key in attributes)
    sel.attr(key, attributes[key])
  return sel
}

/**
 * Get a D3 selection if not already given.
 * @param {Element|D3 Selection} container
 * @return {D3 Selection}
 */
export function maybeSelect (obj) {
  return obj instanceof Element ? d3.select(obj) : obj
}

/**
 * Render the given element tree into the container.
 * @param {Element|D3 Selection} container
 * @param {D3Element} d3Element
 * @return {Object} A nested data structure of bindings for use in tinier.
 */
export function render (container, d3Element) {
  if (!isD3Element(d3Element))
    throw Error('Second argument must be a D3Element')
  const sel = appendOrUpdate(maybeSelect(container),
                             d3Element.tagName,
                             d3Element.attributes)
  const childObj = d3Element.children
  // deal with children
  if (isArray(childObj)) {
    return childObj.reduce((bindings, child) => {
      if (!isD3Element(child))
        throw Error('Every element of a child array must be a D3Element')
      return merge(bindings, render(sel, child))
    }, {})
  } else if (isD3Element(childObj)) {
    return render(sel, childObj)
  } else if (isD3Binding(childObj)) {
    return set({}, childObj.address, sel.node())
  } else if (isString(childObj)) {
    sel.text(childObj)
    return {}
  } else if (childObj === null) {
    return {}
  } else {
    throw Error('Unrecognized content in D3Element: ' + d3Element.children)
  }
}

/**
 * @param {Array} address
 * @return {D3Binding}
 */
export function binding (address) {
  return { type: D3Binding, address }
}
