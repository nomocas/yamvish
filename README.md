# yamvish

Yet Another MVish isomorphic javascript library.
 
Inspired from React, Ractive, jsblocks and Riot.

- really fast both sides.
- no need of jquery/zepto or cheerio/jsdom (but you could if needed).
- really small
	- core : +- 8Ko minified/gzipped (28 Ko min).
	- with parsers : 10(/36) Ko. 
	- full with plugins : 19(/63) Ko)
- dead simple. minimal learning curve.

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
- even if it's really fast in the browser with Virtual/DOMElements handling, rendering is much faster under nodejs when using string output.
- allow WebComponent style

__Promise and Async awareness__
- use and handle Promises when needed to manage asynchroneous timing
- easy way to get end-of-actions events/promises (mounted, unmounted, destroyed, done)

__Plugins__
Even if it's easily usable with other third party lib (routers, ressources/model managers, ...), it plays really nicely with those extensions that you could find in the plugins folder from sources :
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
		data:{
			title: 'Simpler is Better',
			active: false,
			user:'',
			users: ["John", "Bill"],
			articles: [{
				title: 'Smaller is Better',
				content:'lorem ipsum'
			}]
		}, 
		handlers:{
	    	addUser : function(event) {
				this.push('users', this.get('user'));
			}
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

## js/html mix Example

Exactly the same example than above (but a really few detail... could you find it ? :))

```html 
<body>
	<div id="my-container">
		<h1>{{ title }}</h1>
		<input type="text" value="{{ user }}">
		<button data-template="click(addUser).setClass('your-class', 'active')">add user</button>
		<div>
			<h2>Users</h2>
			<ul data-template="each(users)">
				<li><a href="#/user/{{ $this }}">{{ $this }}</a></li>
			</ul>
		</div>
		<div>
			<h2>Articles</h2>
			<div data-template="each(articles)">
				<h3>{{ title }}</h3>
				<p>{{ content }}</p>
			</div>
		</div>
	</div>

	<script type="text/javascript" src="path/to/yamvish.min.js"></script>
	<script type="text/javascript">

		// define a context
		var context = new y.Context({ 
			data:{
				title: 'Simpler is Better',
				active: false,
				user: '',
				users: ['John', 'Bill'],
				articles: [{
					title: 'Smaller is Better',
					content:'lorem ipsum'
				}]
			}, 
			handlers:{
		    	addUser : function(event) {
					this.push('users', this.get('user'));
				}
			}
		});

		var mountPoint = document.getElementByID('my-container'),
			template = yamvish.dom.elementChildrenToTemplate(mountPoint),
			container = template.toContainer(context).mount(mountPoint);

		context.set('active', true)
		.set('users.1', 'William')
		.push('users', 'Bob')
		.push('articles', {
			title: 'Faster is Better',
			content:'dolor sit amet'
		})
		.del('users.0');
	</script>
</body>
```

## View example

Exactly the same example than above.
(A View is simply a compilation of Context, Virtual and Template API)

```javascript

var view = new y.View({
	data: {
		title: 'Simpler is Better',
		active: false,
		user: '',
		users: ["John", "Bill"],
		articles: [{
			title: 'Smaller is Better',
			content: 'lorem ipsum'
		}]
	},
	handlers: {
		addUser: function(event) {
			this.push('users', this.get('user'));
		}
	}
});


view.h(1, '{{ title }}')
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

view.mount(document.body);

// manipulate data from view. UI will update accordingly.
view.set('active', true)
	.set('users.1', 'William')
	.push('users', 'Bob')
	.push('articles', {
		title: 'Faster is Better',
		content: 'dolor sit amet...'
	})
	.del('users.0');
```

## API

### Main Classes 

Templating chainable API
- y.Template
	- base : done, catch, if, all, destroy, remove
	- context management : set, push, del, handler, context, with
	- attributes : attr, setClass, id, val
	- events : on, off + basical dom events (click, focus, blur, ...)
	- tags : text, tag, div, ul, input, h, p, ...
	- array loop : each, filter, sort
	- css : style, visible
	- inheritance and specialisation : up, bottom
	- from plugins : route, load

Minimal mockup of standard (modern) DOM node : 
- y.Virtual 		
	- setAttribute
	- addEventListener/removeEventListener
	- appendChild
	- classList.add, classList.remove
	- toContainer()/toString()

Observable data map that holds also event's handlers.
- y.Context 		
	- subscribe/unsubscribe
	- get(path), set(path, value), push(path, value), del(path)
	- reset(value)
	- notify/notifyAll

View : It's just there to provide easy structuration. Absolutly optional.
- y.View
	- compilation of Template + Virtual + Context API
	- there is nothing that you could do with View that you couldn't do with other classes. 
	- View is bundled with minimal John Resig Simple Class Inheritance 

### Plugins

#### Dynamic-in-place router



#### c3po bridge



### Misc

DOM To Template Parsers :
- y.dom.elementToTemplate(DOMElement) : Template
- y.dom.elementChildrenToTemplate(DOMElement) : Template

HTML to Template Parser :
```javascript
var template = y.html.parse('<ul data-template="each(\'users\').click(\'hello\')" class="foo"><li>{{ $this }}</li></ul><p>{{ title }}</p>');

var context = new y.Context({
  data:{
    title: 'Simpler is Better',
    users: ["John", "Bill"]
  }, 
  handlers:{
    hello : function(event) {
      console.log("click hello");
    }
  }
});

var elem = document.createElement('section');
 
template.call(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```

Template String parser : 
```javascript
var template = y.expression.parseTemplate("ul(each('users', li(text('{{ $this }}'))).click('hello'))");
var context = new y.Context({
  data:{
    users: ["John", "Bill"]
  }, 
  handlers:{
    hello : function(event) {
      console.log("click hello");
    }
  }
});

var elem = document.createElement('section');
 
template.call(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```

Expression String parser : 
```javascript
var expression = y.expression.parse(" users.1 | lower ");


var elem = document.createElement('section');
 
template.call(elem, context);

document.body.appendChild(elem);

context.push('users', 'Biloud');
```


Component Registration
- y.addComponent(name, template || view);

Interpolable string manager : (You should never use it directly)
- y.Interpolable 	
	- output(context)
	- subscribeTo(context, path, callback)


### More Example


Modify context data by hand then notify.
```javascript
 	// define a context
	var context = new y.Context({ 
		data:{
			users: ['John', 'Bill']
		}
	});
	context.data.users.push("jean");
  	context.notify('push', 'users', 'Jean', view.data.users.length -1);
```


## Licence

The [MIT](http://opensource.org/licenses/MIT) License

Copyright (c) 2015 Gilles Coomans <gilles.coomans@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
