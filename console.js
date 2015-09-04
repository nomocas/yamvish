/*
	Times : 
			nodejs : 23ms/1K (165ms/10K)  new node + new query + exec query + toString
			browser : 75ms/1K (790ms/10K)   new node + new query + exec query + toString
 
 			nodejs :  37 ms / 10K  					toString
			browser : 174 ms / 10K (18ms/1000) 		toString

			browser 	65 ms / 1K 					body.appendChild(render())
			browser 	60 ms / 1K 					body.innerHTML = toString())
 */

if (typeof require !== 'undefined')
	yamvish = require("./index");
var y = yamvish;
//______________________________________________ TESTS BROwSER
try {
	var q = y()
		//.set('test', 'world')
		//.set('deep', 'DEEEEEP')
		//.set('items', ["john", "biloud", "pirlouit"])
		//.set('amis', [{title:'MARCO'},{title:'CEDRIC'}])
		.attr('some', '{{ test }}')
		.setClass('zoo')
		.div(
			y().text('hello {{ test }}')
			.click(function(context, event) {
				context.push('items', Math.random());
				//console.log("click : ", this, context, event);
			})
		)
		.div(
			y().setClass('haaaaaaaaaa', 'active')
			.ul(
				y().setClass('bloupiiiiiiii')
				.each('items', y().li(y().text('{{ $this }}')))
			)
			.ul(
				y().setClass('zzzzzzzzzzz')
				.each('amis', y().li(
					y()
					.attr('fromParent', '{{ $parent.test }}')
					.text('soooooooo {{ title }}')
				))
			)
			.div(
				y().text('{{ deep }} div')
			)
			.span(y().text('deep inner span'))
		)
		.tag('span', y().text('rooo'));

	document.body.innerHTML = '';

	var context = new y.Context({
		test: 'world',
		deep: 'foo',
		active: false,
		items: ["john", "biloud", "pirlouit"],
		amis: [{
			title: 'MARCO'
		}, {
			title: 'CEDRIC'
		}]
	});

	for (var i = 0; i < 100; ++i) {
		var o = new y.Virtual('div');
		q.call(o, context);
		document.body.appendChild(o.toElement());
	}

	console.time("t");

	context.set('active', true)
		.set('items.1', 'lollipop !')
		.set('test', 'YAMOO !')
		.push('items', 'johnetta')
		.push('amis', {
			title: 'philippe'
		})
		.del('items.2')
		.del('amis.1');

	console.timeEnd("t");

} catch (e) {
	console.log("error : ", e, e.stack);
}
/*

try {
	var context = new y.Context();
	var cb = function(type, value) {
		console.log("hello has been setted to :", value, type);
	};
  var cb2 = function(type, value) {
		console.log("hello.foo has been setted to :", value, type);
	};
	context.subscribe('hello', cb);
  var unsub = context.subscribe('hello.foo', cb2);
 
  console.time("obs");
	for (var i = 0; i < 1; ++i)
  {

    
  }
  context.reset({
		'hello': Math.random()
	});
  context.set('hello', { bar:true });
  
  context.set('hello.foo', 'blupi');

  context.set('hello', 'bloupi');
  
  
  unsub()
  context.set('hello.foo', 'blupzzzzzi');
  
  console.timeEnd("obs")
	console.log("obs : ", context)
	//
} catch (e) {
	console.log("error :", e);
}
	*/
