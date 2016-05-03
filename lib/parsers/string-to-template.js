/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing data-template attributes as :
 * text('hello').div('bloupi').click('showAll(myVar)')
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	primitiveArguments = require('./primitive-argument-rules');

var rules = {
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
				t = compile(descriptor.calls);
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
				r().oneOf(['integer', 'float', 'bool', 'singlestring', 'doublestring', 'templates']),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

for (var i in primitiveArguments)
	rules[i] = primitiveArguments[i];

var parser = new Parser(rules, 'templates');

function compile(calls) {
	var ch = new Template();
	for (var i = 0, len = calls.length; i < len; ++i) {
		var call = calls[i];
		if (!ch[call.method])
			throw new Error('no handler found in Template as : ' + call.method);
		ch[call.method].apply(ch, call.arguments);
	}
	return ch;
}

var templateCache = {};

parser.parseTemplate = function(string) {
	if (templateCache[string] !== undefined)
		return templateCache[string].calls;
	var result = templateCache[string] = parser.parse(string);
	if (result === false)
		return false;
	return result.calls;
};

module.exports = parser;

/*
console.log(y.expression.parseTemplate("click ( '12', 14, true, p(2, 4, span( false).p())). div(12345)"));
 */
