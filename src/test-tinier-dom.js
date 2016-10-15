/* global global */

import {
  ELEMENT, BINDING, addressToObj, h, bind, createDOMElement, getStyles,
  updateDOMElement, objectForBindings, render,
} from './tinier-dom'

import { describe, it, afterEach, } from 'mocha'
import { assert } from 'chai'

import jsdom from 'jsdom'
const document = jsdom.jsdom()
const window = document.defaultView
const el = document.body
global.Element = window.Element
global.Text = window.Text
global.document = document

function mouseClick (el) {
  el.dispatchEvent(new window.MouseEvent('click',
                                         { view: window,
                                           bubbles: true,
                                           cancelable: true }))
}

describe('addressToObj', () => {
  it('nested arrays and objects', () => {
    assert.deepEqual(addressToObj([ 2, 'a' ], 'VAL')[2], { a: 'VAL' })
  })
})

describe('h', () => {
  it('returns an object', () => {
    assert.deepEqual(
      h('div'),
      { tagName: 'div', attributes: {}, children: [], type: ELEMENT }
    )
  })

  it('takes children as an array', () => {
    assert.deepEqual(
      h('div', null, 'a', 'b'),
      { tagName: 'div', attributes: {}, children: [ 'a', 'b' ], type: ELEMENT }
    )
  })
})

describe('bind', () => {
  it('accepts an address', () => {
    assert.deepEqual(bind([ 'a', 'b' ]),
                     { type: BINDING, address: [ 'a', 'b' ] })
  })

  it('accepts a single loc', () => {
    assert.deepEqual(bind('a'),
                     { type: BINDING, address: [ 'a' ] })
  })
})

describe('createDOMElement', () => {
  it('choose correct namespace -- html', () => {
    const tEl = h('html', { 'href': 'http://a.com',
                            'xlink:href': 'http://b.com', })
    const el = createDOMElement(tEl, document.body)
    // check element namespace
    assert.strictEqual(el.namespaceURI, 'http://www.w3.org/1999/xhtml')
    // check attribute namespaces
    assert.strictEqual(el.getAttributeNS('http://www.w3.org/1999/xhtml', 'href'),
                       'http://a.com')
    assert.strictEqual(el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
                       'http://b.com')
  })

  it('choose correct namespace -- svg', () => {
    assert.strictEqual(createDOMElement(h('svg'), document.body).namespaceURI,
                       'http://www.w3.org/2000/svg')
  })

  it('choose correct namespace -- inherit', () => {
    const svg = createDOMElement(h('svg'), document.body)
    assert.strictEqual(createDOMElement(h('g'), document.body).namespaceURI,
                       'http://www.w3.org/1999/xhtml')
    assert.strictEqual(createDOMElement(h('g'), svg).namespaceURI,
                       'http://www.w3.org/2000/svg')
  })

  it('choose correct namespace -- explicit', () => {
    assert.strictEqual(createDOMElement(h('svg:g'), document.body).namespaceURI,
                       'http://www.w3.org/2000/svg')
    // keep xmlns prefix
    assert.strictEqual(createDOMElement(h('xmlns:g'), document.body).namespaceURI,
                       'http://www.w3.org/2000/xmlns/')
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
    updateDOMElement(newEl, <input style={ newStyle }></input>)
    assert.strictEqual(newEl.style.borderRadius, '')
    assert.strictEqual(newEl.style.borderColor, 'green')
    assert.strictEqual(newEl.getAttribute('onClick'), null)
    assert.strictEqual(newEl.id, '')
    assert.strictEqual(newEl.getAttribute('disabled'), null)
  })

  it('converts accepts class', () => {
    render(el, <input></input>)
    const newEl = el.firstChild
    updateDOMElement(newEl, <input class="empty"></input>)
    assert.strictEqual(newEl.getAttribute('class'), 'empty')
  })

  it('handles special form attributes -- checked', () => {
    render(el, <input type='checkbox'></input>)
    const newEl = el.firstChild
    assert.isFalse(newEl.hasAttribute('checked'))
    updateDOMElement(newEl, <input checked={ true }></input>)
    assert.isTrue(newEl.checked)
    updateDOMElement(newEl, <input checked={ false }></input>)
    assert.isFalse(newEl.checked)
  })

  it('removes on* functions', () => {
    let called = 0
    const inc = () => called++
    render(el, <input></input>)
    const newEl = el.firstChild
    updateDOMElement(newEl, <input onClick={ inc }></input>)
    updateDOMElement(newEl, <input></input>)
    mouseClick(newEl)
    assert.strictEqual(called, 0)
  })

  it('does not set on* functions multiple times', () => {
    let called = 0
    const inc1 = () => called++
    const inc2 = () => called++
    render(el, <input></input>)
    const newEl = el.firstChild
    updateDOMElement(newEl, <input onClick={ inc1 }></input>)
    updateDOMElement(newEl, <input onClick={ inc2 }></input>)
    mouseClick(newEl)
    assert.strictEqual(called, 1)
  })

  it('takes then attribute', () => {
    let called = null
    render(el, <input></input>)
    const newEl = el.firstChild
    updateDOMElement(newEl, <input then={ el => called = el }></input>)
    assert.strictEqual(called, newEl)
  })
})

describe('objectForBindings', () => {
  it('arrays', () => {
    const ar3 = Array(3)
    ar3[2] = 'c'
    const res = objectForBindings([ [ null, 'b', null, 'd', 0 ], [ 'a' ], ar3 ])
    assert.deepEqual(res, [ 'a', 'b', 'c', 'd', 0 ])
  })

  it('objects', () => {
    const res = objectForBindings([ { a: 1 }, { b: 2, c: [ 3 ] },
                                    { c: [ null, 4 ]} ])
    assert.deepEqual(res, { a: 1, b: 2, c: [ 3, 4 ] })
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

  it('renders text, and casts other objects to String', () => {
    render(el, <div>hey!, <span>hello</span> world</div>, ':-)')
    // run again to make sure text nodes are updated
    render(el, <div>hiya!, <span>hello</span>{ 2 }</div>)
    const nodes = el.firstChild.childNodes
    assert.strictEqual(nodes[0].textContent, 'hiya!, ')
    assert.strictEqual(nodes[1].textContent, 'hello')
    assert.strictEqual(nodes[2].textContent, '2')
    assert.strictEqual(el.childNodes.length, 1)
  })

  it('does not render null', () => {
    render(el, <div>hey!, <span>hello</span> world</div>, ':-)')
    // run again to make sure text nodes are updated
    render(el, <div>hiya!, { null }<span>{ null }</span>{ 2 }</div>)
    const nodes = el.firstChild.childNodes
    assert.strictEqual(nodes[0].textContent, 'hiya!, ')
    assert.strictEqual(nodes[1].textContent, '')
    assert.strictEqual(nodes[2].textContent, '2')
  })

  it('renders multiple divs', () => {
    const el1 = document.createElement('div')
    el.appendChild(el1)
    const el2 = document.createElement('div')
    el.appendChild(el2)
    render(el1, <div>hello</div>, <div><span>world</span><span>!</span></div>)
    render(el2, <div>hello2</div>, <div><span>world2</span><span>!2</span></div>)
    assert.strictEqual(el1.firstChild.textContent, 'hello')
    assert.strictEqual(el1.lastChild.firstChild.textContent, 'world')
    assert.strictEqual(el1.lastChild.lastChild.textContent, '!')
    assert.strictEqual(el2.firstChild.textContent, 'hello2')
    assert.strictEqual(el2.lastChild.firstChild.textContent, 'world2')
    assert.strictEqual(el2.lastChild.lastChild.textContent, '!2')
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

  it('returns a bindings object -- top', () => {
    const bindings = render(el, bind([ 'a', 'b' ]))
    const expect = { a: { b: el } }
    assert.deepEqual(bindings, expect)
  })

  it('returns a bindings object -- no array, string', () => {
    const bindings = render(el, bind('at'))
    const expect = { at: el }
    assert.deepEqual(bindings, expect)
  })

  it('returns a bindings object -- no array, integer', () => {
    const bindings = render(el, bind(1))
    const expect = Array(2)
    expect[1] = el
    assert.deepEqual(bindings, expect)
  })

  it('returns a bindings object -- multiple', () => {
    const bindings = render(
      el,
      <div>
        <a href="goo.gl">{ bind([ 'a', 'b' ]) }</a>
        <a href="goo.gl">{ bind([ 'a', 'c' ]) }</a>
      </div>
    )
    const expect = { a: {
      b: el.firstChild.children[0],
      c: el.firstChild.children[1],
    } }
    assert.deepEqual(bindings, expect)
  })

  it('returns a bindings object -- sibling', () => {
    assert.throws(() => {
      const bindings = render(
        el,
        <div>
          <div></div>
          { bind([ 'a', 'b' ]) }
        </div>
      )
    }, /A binding cannot have siblings in TinierDOM/)
  })

  it('accepts lists of nodes', () => {
    const nodes = [ 'a', 'b', 'c' ].map((x, i) => {
      return <div id={ x }>{ bind([ i ]) }</div>
    })
    const bindings = render(el, <div>{ nodes } Tashi</div>)
    assert.strictEqual(el.firstChild.childNodes.length, 4)
    assert.strictEqual(el.firstChild.childNodes[0].id, 'a')
    assert.strictEqual(el.firstChild.childNodes[3].textContent, ' Tashi')
    assert.strictEqual(bindings.length, 3)
    assert.strictEqual(bindings[0], el.firstChild.firstChild)
  })

  it('adds listeners', (done) => {
    render(el, <div onClick={ () => done() }></div>)
    mouseClick(el.firstChild)
  })

  it('error for invalid listeners', () => {
    assert.throws(() => {
      const methods = {}
      render(el, <div onClick={ methods.bad }></div>)
    })
  })

  it('removes listeners', () => {
    let clicked = false
    render(el, <div onClick={ () => clicked = true }></div>)
    render(el, <div></div>)
    mouseClick(el)
    assert.isFalse(clicked)
  })
})
