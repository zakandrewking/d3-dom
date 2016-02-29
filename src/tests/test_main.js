/* global global */

'use strict'

import { h, render, binding, ELEMENT, BINDING, getStyles, updateDOMElement,
         addressToObj, mergeBindings, } from '../main'

import { describe, it, afterEach, } from 'mocha'
import { assert } from 'chai'

import jsdom from 'jsdom'
const document = jsdom.jsdom()
const window = document.defaultView
const el = document.body
global.Element = window.Element
global.Text = window.Text
global.document = document

describe('addressToObj', () => {
  it('nested arrays and objects', () => {
    assert.deepEqual(addressToObj([ 2, 'a' ], 'VAL')[2], { a: 'VAL' })
  })
})

describe('mergeBindings', () => {
  it('arrays', () => {
    const ar3 = Array(3)
    ar3[2] = 'c'
    assert.deepEqual(mergeBindings([ [ null, 'b', null, 'd' ], [ 'a' ], ar3 ]),
                     [ 'a', 'b', 'c', 'd' ])
  })

  it('objects', () => {
    assert.deepEqual(mergeBindings([ { a: 1 }, { b: 2, c: [ 3 ] }, { c: [ null, 4 ]} ]),
                     { a: 1, b: 2, c: [ 3, 4 ] })
  })
})

describe('h', () => {
  it('returns an object', () => {
    assert.deepEqual(
      h('div'),
      { tagName: 'div', attributes: {}, children: [], type: ELEMENT }
    )
  })
})

describe('getStyles', () => {
  it('finds style names', () => {
    assert.deepEqual(getStyles('border-color: green; top: 25px;'),
                     ['border-color', 'top'])
  })
})

describe('updateDOMElement', () => {
  it('removes old styles and attributes', () => {
    // Create an element
    const style = { 'border-radius': '10px', 'border-color': 'red' }
    const fn = () => 'abc'
    render(el, <input disabled onClick={ fn } style={ style } id="a"></input>)
    const newEl = el.firstChild
    // Update the element
    const newStyle = { 'border-color': 'green' }
    updateDOMElement(newEl, <input class="empty" style={ newStyle }></input>)
    assert.strictEqual(newEl.style.borderRadius, '')
    assert.strictEqual(newEl.style.borderColor, 'green')
    assert.strictEqual(newEl.getAttribute('class'), 'empty')
    assert.strictEqual(newEl.getAttribute('onClick'), null)
    assert.strictEqual(newEl.id, '')
    assert.strictEqual(newEl.getAttribute('disabled'), null)
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

  it('renders text with elements', () => {
    render(el, <div>hey!, <span>hello</span> world</div>, ':-)')
    // run again to make sure text nodes are updated
    render(el, <div>hiya!, <span>hello</span> world</div>)
    const nodes = el.firstChild.childNodes
    assert.strictEqual(nodes[0].textContent, 'hiya!, ')
    assert.strictEqual(nodes[1].textContent, 'hello')
    assert.strictEqual(nodes[2].textContent, ' world')
    assert.strictEqual(el.childNodes.length, 1)
  })

  it('renders multiple divs', () => {
    render(el, <div>hello</div>, <div><span>world</span><span>!</span></div>)
    const newEl = el.firstChild
    const newEl2 = el.lastChild.firstChild
    const newEl3 = el.lastChild.lastChild
    assert.strictEqual(newEl.textContent, 'hello')
    assert.strictEqual(newEl2.textContent, 'world')
    assert.strictEqual(newEl3.textContent, '!')
  })

  it('renders nested elements with attributes', () => {
    render(el, <div><a href="goo.gl">goog</a></div>)
    const newEl = el.firstChild.firstChild
    assert.strictEqual(newEl.getAttribute('href'), 'goo.gl')
    assert.strictEqual(newEl.textContent, 'goog')
  })

  it('rearrange by ID', () => {
    render(el, <div>
           <div id="n1"></div>
           <div id="n2"></div>
           <div id="n3"></div>
           <div id="n4"></div>
           </div>)
    const children = Array.from(el.firstChild.children)
    render(el, <div>
           <div id="n4"></div>
           <div id="n1"></div>
           <div></div>
           <div id="n2"></div>
           <div id="n3"></div>
           </div>)
    children.map((c, i) => {
      assert.strictEqual(c, document.getElementById('n' + String(i + 1)))
    })
    assert.strictEqual(el.firstChild.firstChild.id, 'n4')
  })

  it('accepts camel-case or css-style CSS keys', () => {
    render(el, <div style={{ 'border-color': 'red' }}></div>)
    assert.strictEqual(el.firstChild.style.borderColor, 'red')
    render(el, <div style={{ borderRadius: '2px' }}></div>)

    assert.strictEqual(el.firstChild.style.borderRadius, '2px')
  })

  it('accepts style string', () => {
    render(el, <div style="border-color: red;"></div>)
    assert.strictEqual(el.firstChild.style.borderColor, 'red')
  })

  it('returns a bindings object', () =>{
    const b = render(el, <div><a href="goo.gl">{ binding(['a', 'b']) }</a></div>)
    const newEl = el.firstChild.firstChild
    assert.deepEqual(b, { a: { b: newEl }})
  })

  it('accepts lists of nodes', () => {
    const nodes = [ 'a', 'b', 'c' ].map((x, i) => {
      return <div id={ x }>{ binding([ i ]) }</div>
    })
    const bindings = render(el, <div>{ nodes } Tashi</div>)
    assert.strictEqual(el.firstChild.childNodes.length, 4)
    assert.strictEqual(el.firstChild.childNodes[0].id, 'a')
    assert.strictEqual(el.firstChild.childNodes[3].textContent, ' Tashi')
    assert.strictEqual(bindings.length, 3)
    assert.strictEqual(bindings[0], el.firstChild.firstChild)
  })

})
