# yamvish

Yet Another MVish isomorphic javascript library.
 
Inspired from React, Ractive, jsblocks and Riot.

- really fast both sides.
- no need of jquery/zepto or cheerio/jsdom.
- really small (less than 4Ko minified/gzipped for the moment. should grow slightly)
- dead simple. minimal learning curve.

__Data binding__ (Ractive inspiration)
- based on simple observable-data-map (of course with two-way)
- has 'downstream' and 'upstream' binding

__Fast Templating__ (Virtual and/or pure HTMLElement handeling)
- simple and small Template chainable/nestable API that hold a tree of functions to apply on any node (Virtual or DOM)
- any html fragment (from string or DomElement) has an equivalent in yamvish Template API. So you could develop complete html views using only pure JS or only pure HTML or a mix of both.
- minimal HTML foot-print : a single attribute for everything ("data-template")
- could output to DOMElement or to String.
- even if it's really fast in the browser with Virtual/DOMElements handling, rendering is much faster under nodejs when using Virtual/String output.
- allow WebComponent style
- allow simple inheritance and specialisation between Templates or Views

__Promise awareness__
- use and handle Promises when needed to manage asynchroneous timing

__More__
- highly and easily extensible
- close to standard. should work on IE9 with polyfills (classList, addEventListener, Promise). (maybe on IE8 - to test ;))
- UMD distribution, Common JS sources
- clean code, easy to understand and to maintain or contribute ;).

__Plugins__
Even if it's easily usable with other third party routers or ressources/model managers, it plays really nicely with those two extensions that you could find in the plugins folder from sources :
- yamvish router : dynamic-in-place routing made easy
- [c3po](https://github.com/nomocas/c3po) bridge : open pattern for ressources management wich provide clean way for handling transparently different ressources drivers from browser or server side. This allow real and __complete__ isomorphism


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
			y()
			.h(2, 'Articles')
			.each('articles', 
				y()
				.h(3, '{{ title }}')
				.p('{{ content }}')
			)
		);

	// define a context
	var context = new y.Context({
    	// data
		title: 'Simpler is Better',
		active: false,
		user:'',
		users: ["John", "Bill"],
		articles: [{
			title: 'Smaller is Better',
			content:'lorem ipsum'
		}]
	},{
    	// handlers
    	addUser : function(context, event) {
			context.push('users', context.get('user'));
		}
  	});
  
  	// create a virtual node (could be a document.createElement('div'))
	var node = new y.Virtual('div');
	// apply template on it and bind it to context
	template.call(node, context);

	// (if virtual node : render to DOMElement then) append it somewhere
	document.body.appendChild(node.toElement());
	
	// manipulate data from context. UI will update accordingly.
	context.set('active', true)
		.set('users.1', 'William')
		.push('users', 'Bob')
		.push('articles', {
			title: 'Faster is Better'
		})
		.del('users.0');
```

## js/html mix Example

Exactly the same example than above (but a really few detail... could you find it ? :))

```html 
<body>
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

	<script type="text/javascript" src="path/to/yamvish.min.js"></script>
	<script type="text/javascript">

		// define a context
		var context = new y.Context({
	    	// data
			title: 'Simpler is Better',
			active: false,
			user:'',
			users: ["John", "Bill"],
			articles: [{
				title: 'Smaller is Better',
				content:'lorem ipsum'
			}]
		},{
	    	// handlers
	    	addUser : function(context, event) {
				context.push('users', context.get('user'));
			}
	  	});

		yamvish.analyse(document.body, context);

		context.set('active', true)
		.set('users.1', 'William')
		.push('users', 'Bob')
		.push('articles', {
			title: 'Faster is Better'
		})
		.del('users.0');
	</script>
</body>
```

## API

### Classes 

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
	- toElement()/toString()

Observable data map that holds also event's handlers.
- y.Context 		
	- subscribe/unsubscribe
	- get(path), set(path, value), push(path, value), del(path)
	- notify/notifyAll

Interpolable string manager : (You should never use it directly)
- y.Interpolable 	
	- output(context)
	- subscribeTo(context, path, callback)

View : It's just there to provides easy structuration. Absolutly optional.
- y.View
	- mix of Template and Virtual API + holds a context instance (y.Context)
	- there is nothing that you could do with View that you couldn't do with other classes. 


### Misc

DOM Parsers :
- y.elementToTemplate(DOMElement)
- y.elementChildrenToTemplate(DOMElement)

String Parser :
- y.stringToTemplate(string) (To do)

Component Registration
- y.addComponent(name, template || view);





## Licence

The [MIT](http://opensource.org/licenses/MIT) License

Copyright (c) 2015 Gilles Coomans <gilles.coomans@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
