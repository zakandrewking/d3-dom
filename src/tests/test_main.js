/* global global */

'use strict'

import { h, maybeSelect, render, D3Element, } from '../main'
import d3 from 'd3'

import { describe, it } from 'mocha'
import { assert } from 'chai'

import jsdom from 'jsdom'
const document = jsdom.jsdom()
const window = document.defaultView
global.Element = window.Element

describe('h', () => {
  it('returns an object', () => {
    assert.deepEqual(
      h('div'),
      { tagName: 'div', attributes: {}, children: null, type: D3Element }
    )
  })
})

describe('maybeSelect', () => {
  it('select Elements', () => {
    const body = document.body
    assert.equal(maybeSelect(body).node(), body)
  })
  it('returns d3 selections', () => {
    const sel = d3.select(document)
    assert.equal(maybeSelect(sel), sel)
  })
})

describe('render', () => {
  it('renders empty element', () => {
    const sel = d3.select(document.body).append('div')
    render(sel, <div id="new"></div>)
    assert.isFalse(sel.select('#new').empty())
    assert.equal(sel.select('#new').text(), '')
  })

  it('renders text', () => {
    const sel = d3.select(document.body).append('div')
    render(sel, <div>hello world</div>)
    assert.equal(sel.select('div').text(), 'hello world')
  })

  it('renders nested elements with attributes', () => {
    const sel = d3.select(document.body).append('div')
    render(sel, <div><a href="goo.gl">goog</a></div>)
    assert.equal(sel.select('div').select('a').attr('href'), 'goo.gl')
    assert.equal(sel.select('div').select('a').text(), 'goog')
  })

  it('returns a bindings object', () =>{
    const sel = d3.select(document.body).append('div')
    const b = render(
      sel,
        <div><a href="goo.gl">{ binding(['a', 'b']) }</a></div>
    )
    assert.deepEqual(b, { a: { b: sel }})
  })
})
