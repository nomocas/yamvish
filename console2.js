var y = require('yamvish');
var env = require('./lib/env'),
	Virtual = require('./lib/virtual');

env.factory = Virtual;

function range(size) {
	var output = [];
	for (var i = 0; i < size; ++i)
		output.push(Math.random() + "");
	return output;
}

//_____________________________________ STRING

var t = y()
	.set('world', 'yamvish')
	.set('title', 'wuuu')
	.set('items', range(200))
	.div('hello {{ world }}')
	.div('title {{ title }}')
	.p('____')
	.div(
		y().each(
			'items',
			y().p('{{ $this }}')
			.section('biupi')
			.header('{{ $this }}')
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

for (var j = 0; j < 200; ++j)
// t.p('fgfgfg');
	t.p('{{ world }}');



test = {}

test.string = function() {
	var time = new Date().getTime();

	for (var i = 0; i < 1000; ++i)
	// console.log(
		t.toHTMLString()

	time = new Date().getTime() - time;
	console.log('string time : ', time);

};

test.string2 = function() {

	var time = new Date().getTime();
	var promises = [];

	for (var i = 0; i < 1000; ++i)
		promises.push(
			// console.log(
			t.toHTMLString()
		);

	Promise.all(promises)
		.then(function(res) {
			time = new Date().getTime() - time;
			console.log('string time : ', time);
			// string();
		}).catch(function(e) {
			console.error(e);
			console.log(e.stack);
		});
};
//____________________________ TWO PASS


test.twopass = function() {
	var time = new Date().getTime();
	for (var i = 0; i < 1000; ++i) {
		// console.log(
		t.twopass()
	}
	time = new Date().getTime() - time;
	console.log('twopass time : ', time);
};

test.twopass2 = function() {
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
			console.log('twopass2 time : ', time);
			// string();
		}).catch(function(e) {
			console.error(e);
			console.log(e.stack);
		});
};
//____________________________________________________________________________________ DOM



test.dom = function() {
	var time = new Date().getTime();

	for (var i = 0; i < 1000; ++i)
	// console.log(
		t.toContainer(); //.toString()
	// )

	time = new Date().getTime() - time;
	console.log('dom time : ', time);
}



test.dom2 = function() {
	var time = new Date().getTime();

	for (var i = 0; i < 1000; ++i)
	// console.log(
		t.toContainer().toString()
		// )

	time = new Date().getTime() - time;
	console.log('dom2 time : ', time);
}





// string();
// string2();
test.twopass2();
// twopass2();
// /test.dom2();
// test.dom();






var repl = require('repl');

repl.start({
	prompt: 'Node.js via stdin> ',
	input: process.stdin,
	output: process.stdout
});
