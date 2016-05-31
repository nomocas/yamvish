# yamvish

Yet Another MVish isomorphic javascript library.
 
Inspired from React, Ractive, jsblocks and Riot and years of works.

It's there because, as lot of developers obviously, I love all the 451 MV* libs avaiable nowadays (and it stills growing every days...) with all their really great ideas and toon of works, but I was feeling that, as others, simplicity, peformance, completness, readability, reusability AND isomorphism are something that wasn't achieved yet.

So this is the 452th... :)

More seriously, as it would be fool to re-invent the wheel, yamvish try to solve, as primary goal, the big and really complex problem of isomorphism. The Real One.
Not just the possibility to render both sides. That's easy and achieved since decade.
Isomorphism means to write your __whole__ app once then run it both sides __simply__ and __smartly__ without rewriting more than few lines and without killing your server ;).

So yamvish is :
- really fast both sides.
- dont' need jquery/zepto or cheerio/jsdom (but you could if needed).
- really small
	- core : +- 11Ko minified/gzipped (36 Ko min).
	- with parsers : 13 Ko. 
	- full with plugins : 25 Ko.
- dead simple. minimal learning curve.
- absolutly straight forward. just context with data, powerful template and pure dom node handling. 
- minimal obstrusivity. maximum plasticity.

__Data binding__ (Ractive inspiration)
- based on simple observable-data-map (of course with two-way)
- has 'downstream' and 'upstream' binding
- allow computed dependents variables

__Fast Templating__ (Virtual and/or pure HTMLElement handeling)
- simple and small Template chainable/nestable API that hold a tree of functions to apply on any node (Virtual or DOM)
- any html fragment (from string or DomElement) has an equivalent in yamvish Template API. So you could develop complete html views using only pure JS or only pure HTML or a mix of both.
- allow full js expression and filtering
- minimal HTML foot-print : a single attribute for everything ("data-template")
- could output to DOMElement, to virtual nodes, or to String.
- even if it's really fast in the browser with Virtual/DOMElements handling, rendering is even faster under nodejs when using string output.
- allow WebComponent style

__Promise and Async awareness__
- use and handle Promises when needed to manage asynchroneous timing
- easy way to get end-of-actions events/promises (mounted, unmounted, destroyed, done)

__Modularity with Event Programmation__
- define a simple global agora object where to listen/push messages from modules and views

__Concurrency Battle Ready__
- use simple global env object pattern that allow safe server-side isolation and rendering

__Plugins__
Even if it's easily usable with other third party lib (routers, ressources/model managers, any jquery plugin,...), it plays really nicely with those extensions :
- yamvish router : dynamic-in-place routing made easy.
- loader through [c3po](https://github.com/nomocas/c3po) : open pattern for ressources management wich provide clean way for handling transparently different ressources drivers from browser or server side. This allow real and __complete__ isomorphism.
- [RQL](https://github.com/persvr/rql) array filtering, sorting and paging (and many more).
- objects and values types validation with [aright](https://github.com/nomocas/aright) rules.
- minimal http-request client through Promise
- easy date formating with dateFormat and yamvish expression filters
- easy form upload with Mozilla-form-uploader.

__More__
- highly and easily extensible
- close to standard. should work on IE9 with polyfills (normally just Promise). (work on IE8 with https://code.google.com/p/base2/ or more polyfills (setAttribute, addEventListener, ...) - to test ;))
- UMD distribution, Common JS sources
- clean and standard ES5 code, easy to understand and to maintain or contribute ;).


## Pure js Example

```javascript
	var y = require("yamvish");

	// write a Template
	var template = y()
		.h(1,'{{ title }}')
		.input('text', '{{ user }}')
		.button('add user', y().setClass('your-class', 'active').click('addUser'))
  		.div(
			y().h(2, 'Users')
			.ul(
				y().each('users', 
              		y().li(
                		y().a('#/user/{{ $this }}', '{{ $this }}')
              		)
        		)
			)
		)
		.div(
			y().h(2, 'Articles')
			.each('articles', 
				y().h(3, '{{ title }}')
				.p('{{ content }}')
			)
		);

	// define a context
	var context = new y.Context({ 
		title: 'Simpler is Better',
		active: false,
		user:'',
		users: ["John", "Bill"],
		articles: [{
			title: 'Smaller is Better',
			content:'lorem ipsum'
		}],
		addUser : function(event) {
			this.push('users', this.get('user'));
		}
	});
  
  	// create a virtual node (could be a document.createElement('div'))
	// apply template on it and bind it to context
	var container = template.toContainer(context);

	// (if virtual node : render to DOMElement then) append it somewhere
	container.mount(document.body);
	
	// manipulate data from context. UI will update accordingly.
	context.set('active', true)
		.set('users.1', 'William')
		.push('users', 'Bob')
		.push('articles', {
			title: 'Faster is Better',
			content:'dolor sit amet...'
		})
		.del('users.0');
```


## API


### Template

#### Instance

Through yamvish shortcut :
```javascript
var y = require('yamvish');

var template = y(); // using shortcut
template.div('hello world');

var template2 = new y.Template(); // using Template constructor
template2.p('a paragraph');
```

### Context

### Interpolable

### Container

### Plugins

#### Dynamic-in-place router

[routedsl plugin](https://github.com/nomocas/yamvish-router)

#### Load Data

[c3po bridge](https://github.com/nomocas/yamvish-c3po)

#### Date formating

[date format filter](https://github.com/nomocas/yamvish-date-format)

#### Model validation

[aright plugin](https://github.com/nomocas/yamvish-aright)

### Misc

HTML to Template Parser :
```javascript
var template = y.html.parse('<ul data-template="each(\'users\').click(\'hello\')" class="foo"><li>{{ $this }}</li></ul><p>{{ title }}</p>');

var context = new y.Context({
	title: 'Simpler is Better',
	users: ["John", "Bill"]
	hello : function(event) {
	  console.log("click hello");
	}
});

var elem = document.createElement('section');
 
template.toDOM(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```

Template String parser : 
```javascript
var template = y.expression.parseTemplate("ul(each('users', li(text('{{ $this }}'))).click('hello'))");
var context = new y.Context({
    users: ["John", "Bill"]
    hello : function(event) {
      console.log("click hello");
    }
});

var elem = document.createElement('section');
 
template.toDOM(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```

Expression String parser : 
```javascript
var expression = y.expression.parse(" users.1 | lower ");


var elem = document.createElement('section');
 
template.toDOM(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```


## Licence

The [MIT](http://opensource.org/licenses/MIT) License

Copyright (c) 2016 Gilles Coomans <gilles.coomans@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
