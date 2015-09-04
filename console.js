var y = require("./index");
//______________________________________________ TESTS
try {

	var q = y()
		.set('test', 'world')
		.set('deep', 'DEEEEEP')
		.set('items', ["john", "biloud", "pirlouit"])
		.set('articles', [{
			title: 'MARCO'
		}, {
			title: 'SOLIDE'
		}])
		.attr('hello', '{{ test }}')
		.setClass('zoo')
		.div(
			y().text('hello {{ test }}')
		)
		.div(
			y().setClass('haaaaaaaaaa', 'foo')

			.tag('ul',
				y().setClass('bloupiiiiiiii')
				.each('items', y().tag('li', y().text('{{ $this }}')))
			)
			.tag('ul',
				y().setClass('zzzzzzzzzzz')
				.each('articles', y().tag('li', y().text('{{ title }}')))
			)
			.div(
				y().text('{{ deep }} div')
			)
			.tag('span', y().text('deep inner span'))
		)
		.tag('span', y().text('rooo'))



	//var q2 = y().set('items', ['bloui', 'hghg', 'zreezrezrez']).set('deep', 'soooo powerful');

	console.time("t")
	for (var i = 0; i < 1; ++i) {


		var o = new y.Virtual('div', new y.Context());
		q.call(o);

		//		q2.call(o);
		// o.query();
		//document.body.appendChild(
		//o.render()
		//);
		//console.log(
		o.toString()
			// , o
			//)
	}
	console.timeEnd("t")
		//o
} catch (e) {
	console.log("error : ", e);
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
