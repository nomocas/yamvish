var Template = require('./lib/template');
var Context = require('./lib/context');
require('./lib/output-engine/string');
require('./lib/output-engine/twopass');
require('./lib/output-engine/dom');
var env = require('./lib/env'),
	Virtual = require('./lib/virtual');

env.factory = Virtual;

function range(size) {
	var output = [];
	for (var i = 0; i < size; ++i)
		output.push(Math.random() + "");
	return output;
}

y = function() {
	return new Template();
};

y.Context = Context;

//_____________________________________ STRING

var t = y()
	.set('world', 'yamvish')
	.set('title', 'wuuu')
	.set('items', range(150))
	.div('hello {{ world }}')
	.div('title {{ title }}')
	.p('____')
	.div(
		y().each(
			'items',
			y().p('{{ $this }}')
			.section('biupi')
			.header('{{ $this }}')
			.footer('biupi')
		)
	)
	.div(
		y().context()
		.attr('reu', true)
		.set('title', 'weeeeee')
		.text('{{ title }}')
	);

for (var j = 0; j < 500; ++j)
// t.p('fgfgfg');
	t.p('{{ world }}');


function string() {
	var time = new Date().getTime();

	for (var i = 0; i < 1000; ++i)
	// console.log(
		t.toHTMLString(new Context())
		// );
	time = new Date().getTime() - time;
	console.log('string time : ', time);
}
//____________________________ TWO PASS

function twopass() {
	var promises = [];
	var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i) {
		promises.push(
			// console.log(
			t.twopass()
		);
	}
	Promise.all(promises)
		.then(function(res) {
			time = new Date().getTime() - time;
			console.log('twopass time : ', time);
			// string();
		}).catch(function(e) {
			console.error(e);
			console.log(e.stack);
		});
}
//____________________________________________________________________________________ DOM



function dom() {
	var time = new Date().getTime();

	for (var i = 0; i < 1000; ++i)
	// console.log(
		t.toContainer(new Context()) //.toString()
		// )

	time = new Date().getTime() - time;
	console.log('dom time : ', time);
}

function dom2() {
	var time = new Date().getTime(),
		ctx, container;

	var promises = [];
	for (var i = 0; i < 1000; ++i) {
		// console.log(
		ctx = new Context();
		t.toContainer(ctx) //.toString();

		// promises.push(ctx.done());
		// )
	}

	// return Promise.all(promises).then(function() {
	// 	container.toString();
	time = new Date().getTime() - time;
	console.log('dom2 time : ', time);
	// });
}




function contextDone() {
	var time = new Date().getTime();


	var promises = [];
	for (var i = 0; i < 1000; ++i)
	// console.log(
		promises.push(new Context().set('bloupi', false).done());
	// )

	Promise.all(promises).then(function() {
		time = new Date().getTime() - time;
		console.log('contextDone time : ', time);
	})

}





function contextDone2() {
	var time = new Date().getTime();
	var promises = [];
	for (var i = 0; i < 1000; ++i) {
		// console.log(
		var p = new Context()
			.set('bloupi', false)
			.done()
			.then(function(s) {
				return true;
			});
		promises.push(p);
		// )
	}
	Promise.all(promises).then(function() {
		time = new Date().getTime() - time;
		console.log('contextDone time : ', time);
	});
}




// string();




dom();
// twopass();

// twopass();


// dom();

// contextDone2();






var repl = require('repl');

repl.start({
	prompt: 'Node.js via stdin> ',
	input: process.stdin,
	output: process.stdout
});
