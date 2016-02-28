/* global global */

'use strict'

import { h, render, binding, ELEMENT, BINDING, } from '../main'

import { describe, it, afterEach, } from 'mocha'
import { assert } from 'chai'

import jsdom from 'jsdom'
const document = jsdom.jsdom()
const window = document.defaultView
const el = document.body
global.Element = window.Element
global.document = document

describe('h', () => {
  it('returns an object', () => {
    assert.deepEqual(
      h('div'),
      { tagName: 'div', attributes: {}, children: null, type: ELEMENT }
    )
  })
})

describe('render', () => {
  afterEach(() => {
    // clear DOM
    while (el.firstChild) {
      el.removeChild(el.firstChild)
    }
  })

  it('renders empty element', () => {
    render(el, <div id="new"></div>)
    const newEl = el.firstChild
    assert.strictEqual(newEl.id, 'new')
    assert.strictEqual(newEl.textContent, '')
  })

  it('renders text', () => {
    render(el, <div>hello world</div>)
    const newEl = el.firstChild
    assert.strictEqual(newEl.textContent, 'hello world')
  })

  it('renders multiple divs', () => {
    render(el, <div>hello</div>, <div>world</div>)
    const newEl = el.firstChild
    const newEl2 = el.lastChild
    assert.strictEqual(newEl.textContent, 'hello')
    assert.strictEqual(newEl2.textContent, 'world')
  })

  it('renders nested elements with attributes', () => {
    render(el, <div><a href="goo.gl">goog</a></div>)
    const newEl = el.firstChild.firstChild
    assert.strictEqual(newEl.getAttribute('href'), 'goo.gl')
    assert.strictEqual(newEl.textContent, 'goog')
  })

  it('returns a bindings object', () =>{
    const b = render(el, <div><a href="goo.gl">{ binding(['a', 'b']) }</a></div>)
    const newEl = el.firstChild.firstChild
    assert.deepEqual(b, { a: { b: newEl }})
  })
})
