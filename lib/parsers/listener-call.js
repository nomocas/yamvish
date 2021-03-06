/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing listener attribute : e.g. .click('foo(bar, 12)')
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	utils = require('../utils'),
	primitiveArguments = require('./primitive-argument-rules');

var rules = {
	path: r()
		.oneOrMore(null, r().regExp(/^[\w-_\$]+/, false, function(descriptor, cap) {
			(descriptor.path = descriptor.path ||  []).push(cap[0]);
		}), r().regExp(/^\./)),

	call: r()
		.rule('path')
		.done(function(string, descriptor) {
			descriptor.method = descriptor.path;
			descriptor.path = null;
			descriptor.arguments = [];
			return string;
		})
		.zeroOrOne(null,
			r()
			.regExp(/^\s*\(\s*/)
			.zeroOrMore(null,
				r().oneOf(['integer', 'float', 'bool', 'singlestring', 'doublestring', r().rule('path')
					.done(function(string, descriptor) {
						descriptor.arguments.push(descriptor.path);
						descriptor.path = null;
						return string;
					})
				]),
				r().regExp(/^\s*,\s*/)
			)
			.regExp(/^\s*\)/)
		)
};

for (var i in primitiveArguments)
	rules[i] = primitiveArguments[i];

var parser = new Parser(rules, 'call');

parser.parseListener = function(string) {
	var parsed = this.parse(string);
	if (!parsed.method)
		throw new Error('yamvish listener call badly formatted : ' + string);
	return function(e) {
		var self = this,
			method = parsed.method;
		if (method[0] === '$parent') {
			var count = 0;
			while (self && method[count] === '$parent') {
				count++;
				self = self.parent;
			}
			if (!self)
				throw new Error('yamvish listener call could not find parent : ' + string);
			method = method.slice(count);
		}
		var handler = utils.getProp(self.methods, method);
		if (!handler)
			throw new Error('yamvish listener not found : ' + string);
		if (!parsed.arguments)
			return handler.call(self, e);
		var args = [e];
		for (var i = 0, len = parsed.arguments.length; i < len; ++i) {
			var arg = parsed.arguments[i];
			args.push(arg.forEach ? this.get(arg) : arg);
		}
		return handler.apply(self, args);
	};
};

module.exports = parser;
