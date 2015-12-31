var y = require('./index');

y.env.global.debug = true;
y.env.global.factory = y.Virtual;

var numNodes = 100;

function range(size) {
	var output = [];
	for (var i = 0; i < size; ++i)
		output.push(Math.random() + "");
	return output;
}

var context = new y.Context({
	title: 'Simpler is Better',
	sub: 'Simpler',
	users: ["John", "Bill"],
	range: range(numNodes),
	hello: function(event) {
		console.log("click hellossss");
	}
});

function toggleActive() {
	context.toggle('active');
}

//y = y.s;

var templ = y()
	.div(
		// y()
		// // .click('hello')
		// .h(1, '{{ title }}')
		// .ul(
		// 	y().each('users',
		// 		y().li('{{ $this }}')
		// 	)
		// )
	)
	.div({
			hello: 'world',
			classes: {
				active: true
			}
		},
		y()
		.ul(
			y().visible('{{ active }}')
			.each('range',
				y().li(
					y()
					// .click(function(evt) {
					// 	console.log('hello item : ', evt.target.textContent);
					// })
					.p('{{ $this }}')
					.p('freyey')
					.p('azazeaaza')
					.div('{{ $this }}')

				)
			)
		)
		.div(
			y()
			// .click('hello')
			.h(1, '{{ title }}')
		)
	)
	.p('{{ title }} hello {{ sub }}');


var templ2 = y();
for (var k = 0; k < 1000; ++k)
	templ2.text('shloupi');



var templ3 = y();
templ3.each(range(1000), y().text('heu'));

var templ4 = y();
templ4.each(range(1000), y().text('{{ $this }}'));

var templ5 = y();
templ5.each(range(1000), y().div('heu'));

var templ6 = y();
templ6.each(range(1000), y().div('{{ $this }}'));

var virtualContainer, container;

try {

	context.data.range = range(numNodes);
	var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i)
		templ4.toHTMLString(context); //.mount("#mocha");
	time = new Date().getTime() - time;
	console.log('toHTMLString : ', time);

	/*


			var time = new Date().getTime();
			for (var i = 0; i < 1000; ++i) {
				var rg = range(numNodes);
			}
			time = new Date().getTime() - time;
			console.log('range : ', time);


			var time = new Date().getTime();
			for (var i = 0; i < 1000; ++i)
				templ.toContainer(context);
			time = new Date().getTime() - time;
			console.log('toContainer : ', time);

		*/
	//container = templ.toContainer(context);
	/*
		var time = new Date().getTime();
		for (var i = 0; i < 1000; ++i) {
			container.toString();
		}
		time = new Date().getTime() - time;
		console.log('container.toString : ', time);
		*/
	/*var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i) {
		var rg = range(numNodes);
		context.set('range', rg);
		context.set('title', Math.random() + 'reu');
		container.toString();
	}
	time = new Date().getTime() - time;
	console.log('update context + container.toString : ', time);
*/

	console.log('test');
	var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i)
		container = templ.toContainer(context) //.toString();
	time = new Date().getTime() - time;
	console.log('toContainer : ', time);






	/*
		var A = function() {
			this.children = [];
		};
		var a = new A();
		var time = new Date().getTime();
		for (var i = 0; i < 1000; ++i) {
			var b = new A();
			a.children.push(b);
			for (var j = 0; j < 1000; ++j)
				b.children.push(new A());
		}
		time = new Date().getTime() - time;
		console.log('million object: ', time);
	*/
	// console.log(container.toString());

} catch (e) {
	console.log('error : ', e, e.stack);
}
