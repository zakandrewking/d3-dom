/* global global */

import {
  h, render, bind, ELEMENT, BINDING, getStyles, updateDOMElement, addressToObj,
  objectForBindings,
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

describe('objectForBindings', () => {
  it('arrays', () => {
    const ar3 = Array(3)
    ar3[2] = 'c'
    assert.deepEqual(objectForBindings([ [ null, 'b', null, 'd' ], [ 'a' ], ar3 ]),
                     [ 'a', 'b', 'c', 'd' ])
  })

  it('objects', () => {
    assert.deepEqual(objectForBindings([ { a: 1 }, { b: 2, c: [ 3 ] }, { c: [ null, 4 ]} ]),
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

  it('takes children as an array', () => {
    assert.deepEqual(
      h('div', null, 'a', 'b'),
      { tagName: 'div', attributes: {}, children: [ 'a', 'b' ], type: ELEMENT }
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
    updateDOMElement(newEl, <input style={ newStyle }></input>)
    assert.strictEqual(newEl.style.borderRadius, '')
    assert.strictEqual(newEl.style.borderColor, 'green')
    assert.strictEqual(newEl.getAttribute('onClick'), null)
    assert.strictEqual(newEl.id, '')
    assert.strictEqual(newEl.getAttribute('disabled'), null)
  })

  it('converts className to class', () => {
    render(el, <input></input>)
    const newEl = el.firstChild
    updateDOMElement(newEl, <input className="empty"></input>)
    assert.strictEqual(newEl.getAttribute('class'), 'empty')
  })

  it('handles boolean attributes', () => {
    render(el, <input></input>)
    const newEl = el.firstChild
    assert.isFalse(newEl.hasAttribute('checked'))
    updateDOMElement(newEl, <input checked={ true }></input>)
    assert.strictEqual(newEl.getAttribute('checked'), 'checked')
    updateDOMElement(newEl, <input checked={ false }></input>)
    assert.isFalse(newEl.hasAttribute('checked'))
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
