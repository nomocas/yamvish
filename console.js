var y = require('./index');

y.env.global.debug = true;
y.env.global.factory = y.Virtual;

var numNodes = 100;

function range(size) {
	var output = [];
	for (var i = 0; i < size; ++i)
		output.push(Math.random());
	return output;
}

var context = new y.Context({
	data: {
		title: 'Simpler is Better',
		users: ["John", "Bill"],
		range: range(numNodes),
		hello: function(event) {
			console.log("click hellossss");
		}
	}
});

function toggleActive() {
	context.toggle('active');
}

//y = y.s;

var templ = y()
	.div(
		y()
		// .click('hello')
		.h(1, '{{ title }}')
		.ul(
			y().each('users',
				y().li('{{ $this }}')
			)
		)
	)
	.div(
		y()
		.attr('hello', 'world')
		.cl('active')
		.ul(
			y().visible('active')
			.each('range',
				y().li(
					y()
					// .click(function(evt) {
					// 	console.log('hello item : ', evt.target.textContent);
					// })
					.text('{{ $this }}')
					.p('freyey')
					.p('azazeaaza')
					.p('{{ $this }}')
					.p('azazeaaza')
					.p('azazeaaza', y().cl('bloup'))
					.text('hejhej')
					.text('hejhej')
					.text('hejhej')
					.text('hejhej')
					.text('hejhej')
					.text('hejhej')
				)
			)
		)
		.div(
			y()
			// .click('hello')
			.h(1, '{{ title }}')
		)
	)
	.p('{{ title }} hello {{ title }}');

var virtualContainer, container;

try {
	context.data.range = range(numNodes);
	var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i)
	// container = templ.toContainer(context).toString(); //.mount("#mocha");
		container = templ.toHTMLString(context); //.mount("#mocha");

	time = new Date().getTime() - time;

	container = templ.toContainer(context);
	var rg = range(numNodes);
	var time = new Date().getTime();
	// for (var i = 0; i < 1000; ++i)
	context.set('range', rg);
	container.toString()
		// container = templ.toContainer(context);//.mount("#mocha");
		// container = templ.toHTMLString(context); //.mount("#mocha");

	time = new Date().getTime() - time;

	// context.set('range.0', 'Template.toContainer.mount : ' + time);
	// 
	// 
	console.log('time : ', time);
} catch (e) {
	console.log('error : ', e, e.stack);
}
