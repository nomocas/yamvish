/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi/index'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Filter = require('../filter');

var templateCache = {};
var filterCache = {};

var rules = {
	doublestring: r().regExp(/^"([^"]*)"/, false, function(descriptor, cap) {
		descriptor.arguments.push(cap[1]);
	}),
	singlestring: r().regExp(/^'([^']*)'/, false, function(descriptor, cap) {
		descriptor.arguments.push(cap[1]);
	}),
	'float': r().regExp(/^[0-9]*\.[0-9]+/, false, function(descriptor, cap) {
		descriptor.arguments.push(parseFloat(cap[0], 10));
	}),
	integer: r().regExp(/^[0-9]+/, false, function(descriptor, cap) {
		descriptor.arguments.push(parseInt(cap[0], 10));
	}),
	bool: r().regExp(/^(true|false)/, false, function(descriptor, cap) {
		descriptor.arguments.push((cap[1] === 'true') ? true : false);
	}),

	args: r().zeroOrOne(null,
		r()
		.regExp(/^\s*\(\s*/)
		.done(function(string, descriptor) {
			descriptor.arguments = [];
			return string;
		})
		.zeroOrMore(null,
			r().oneOf(['integer', 'bool', 'singlestring', 'doublestring']),
			r().regExp(/^\s*,\s*/)
		)
		.regExp(/^\s*\)/)
	),

	//_____________________________________
	// {{ my.var | filter().filter2(...) }}
	// {{ my.func(arg, ...) }}
	expression: r()
		.done(function(string, descriptor) {
			descriptor.keys = [];
			return string;
		})
		.space()
		.oneOrMore(null,
			r().regExp(/^[\w-_]+/, false, function(descriptor, cap) {
				descriptor.keys.push(cap[0]);
			}),
			r().regExp(/^\s*\.\s*/)
		)
		.rule('args')
		.zeroOrOne(null, r().regExp(/^\s*\|\s*/).rule('filters'))
		.space(),

	//_____________________________________
	// filter().filter2(...).filter3.filter4(...)
	filters: r()
		.space()
		.zeroOrMore('filters',
			r().rule('filter'),
			r().regExp(/^\s*\.\s*/)
		)
		.done(function(string, descriptor) {
			if (descriptor.filters)
				descriptor.filters = compile(descriptor.filters, Filter);
			return string;
		}),

	filter: r()
		.regExp(/^[\w-_]+/, false, 'method') // method name
		.rule('args'),

	//_____________________________________
	// click('addUser').div(p().h(1,'hello'))
	templates: r()
		.space()
		.zeroOrMore('calls',
			r().rule('template'),
			r().regExp(/^\s*\.\s*/)
		)
		.done(function(string, descriptor) {
			var t;
			if (descriptor.calls)
				t = compile(descriptor.calls, this.Template);
			if (t && descriptor.arguments) {
				descriptor.arguments.push(t);
				delete descriptor.calls;
			} else
				descriptor.calls = t;
			return string;
		}),

	template: r()
		.regExp(/^[\w-_]+/, false, function(descriptor, cap) {
			descriptor.method = cap[0];
			descriptor.arguments = [];
		})
		.zeroOrOne(null,
			r()
			.regExp(/^\s*\(\s*/)
			.zeroOrMore(null,
				r().oneOf(['integer', 'bool', 'singlestring', 'doublestring', 'templates']),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

var parser = new Parser(rules, 'expression');

function compile(calls, Chainable) {
	var ch = new Chainable();
	for (var i = 0, len = calls.length; i < len; ++i) {
		var call = calls[i];
		ch[call.method].apply(ch, call.arguments);
	}
	return ch;
}

parser.parseTemplate = function(string) {
	if (templateCache[string] !== undefined)
		return templateCache[string].calls;
	var result = templateCache[string] = parser.parse(string, 'templates');
	if (result === false)
		return false;
	return result.calls;
};

parser.parseFilter = function(string) {
	if (filterCache[string] !== undefined)
		return filterCache[string].filters;
	var result = filterCache[string] = parser.parse(string, 'filters');
	if (result === false)
		return false;
	return result.filters;
};

module.exports = parser;

/*
console.log(y.expression.parse("user.name(12, 'hello') | date('dd-mm-yy').lower", 'expression'));
console.log(y.expression.parse("user.name(12, 'hello') | date.lower", 'expression'));
console.log(y.expression.parse("user.name | date('dd-mm-yy').lower"));
console.log(y.expression.parse("user.name(12, 'hello') | lower", 'expression'));
console.log(y.expression.parse("date('dd-mm-yy').lower", 'filters'));
console.log(y.html.parse('<div class="bloupi"></div>'));
console.log(y.expression.parseTemplate("click ( '12', 14, true, p(2, 4, span( false).p())). div(12345)"));
 */
