var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template');

var rules = {

	emmet: r()
		.regExp(/^([\w-_]+)\s*/, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.zeroOrMore('attrs',
			r().oneOf(['class', 'yam', 'id', 'text', 'attr'])
		),

	class: r()
		.regExp(/^\./, false, function(templ, cap) {
			templ.isClass = true
			templ.xpr = [];
		})
		.rule('interpolable')
		.rule('endExpression'),

	id: r()
		.regExp(/^#/, false, function(templ, cap) {
			templ.isID = true;
			templ.xpr = [];
		})
		.rule('interpolable'),

	attr: r()
		.regExp(/^[\w-]+/, false, function(templ, cap) {
			templ.isAttr = true
			templ.name = cap[0];
			templ.xpr = [];
		})
		.rule('endExpression'),

	endExpression: r()
		.zeroOrOne(null,
			r().regExp(/^\s*\(\s*([^\)]*)\s*\)\s*/, false, function(templ, cap) {
				templ.xpr.push(cap[1]);
			})
		),

	interpolable: r()
		.regExp(/^\{{1,2}[^\}]+\}{1,2}|[\w-_]+/, false, function(templ, cap) {
			templ.xpr.push(cap[0]);
		})
		.space(),

	text: r()
		.regExp(/^~([^~]*)$/, false, function(templ, cap) {
			templ.isText = true;
			templ.text = cap[1];
		}),

	yam: r()
		.regExp(/^y:([\w-_]+)/, false, function(templ, cap) {
			templ.isYam = true;
			templ.name = cap[1];
			templ.xpr = [];
		})
		.rule('endExpression')
};

var parser = new Parser(rules, 'emmet');
parser.toTemplate = function(xpr, template, tagArguments) {
	var parsed = this.parse(xpr);
	if (!parsed)
		throw new Error('emmet style badly formatted : ' + xpr);
	// console.log('emmet parsed : ', parsed);
	var innerTempl = new Template();
	for (var i = 0, len = parsed.attrs.length; i < len; ++i) {
		var attr = parsed.attrs[i];
		if (attr.isClass)
			innerTempl.cl(attr.xpr[0], attr.xpr[1]);
		else if (attr.isID)
			innerTempl.id(attr.xpr[0]);
		else if (attr.isText)
			innerTempl.text(attr.text)
		else if (attr.isYam) {
			if (!innerTempl[attr.name])
				throw new Error('emmet parsing : no template method found with : ', attr.name);
			innerTempl[attr.name].apply(innerTempl, attr.xpr);
		} else
			innerTempl.attr(attr.name, attr.xpr[0]);
	}
	tagArguments = [parsed.tagName, innerTempl].concat(tagArguments || []);
	template = template || new Template();
	return template.tag.apply(template, tagArguments);
}

Template.prototype.emmet = function(xpr) {
	parser.toTemplate(xpr, this, [].slice.call(arguments, 1));
	return this;
};

module.exports = parser;
