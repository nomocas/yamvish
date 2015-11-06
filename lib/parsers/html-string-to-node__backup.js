/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	utils = require('../utils.js'),
	Virtual = require('../virtual.js'),
	expression = require('./string-to-template'),
	htmlRules = require('./html-common-rules');

var rules = {

	// tag children
	children: r()
		.zeroOrMore('childNodes',
			r().oneOf([
				r().space().rule('comment').skip(),
				r().space().rule('tag'),
				r().rule('text')
			])
		),

	text: r().regExp(/^[^<]+/, false, 'textContent'),

	tag: r()
		.regExp(/^<([\w-_]+)\s*/, false, function(descriptor, cap) {
			descriptor.tagName = cap[1].toLowerCase();
		})
		.rule('attributes')
		.oneOf([
			r().char('>')
			.done(function(string, descriptor) {
				if (descriptor.tagName === 'script')
					return this.exec(string, descriptor, this.rules.innerScript); // get script content

				// check html5 unstrict self-closing tags
				if (this.rules.openTags.test(descriptor.tagName))
					return string; // no children

				if (descriptor.dataTemplate && descriptor.dataTemplate._hasEach) {

				}

				// get inner tag content
				return this.exec(string, descriptor, this.rules.tagContent);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		]),

	attributes: r().zeroOrMore(null,
		r().regExp(/^([\w-_]+)\s*(?:=(?:"([^"]*)"|([\w-_]+)))?\s*/, false, function(descriptor, cap, opt) {
			var attrName = cap[1],
				value = (cap[2] !== undefined) ? cap[2] : ((cap[3] !== undefined) ? cap[3] : '');
			if (attrName === 'class')
				value.split(/\s+/).forEach(function(cl) {
					descriptor.classList.add(cl);
				});
			else if (attrName === 'data-template') {
				var template = expression.parseTemplate(value);
				if (template !== false) {
					descriptor.dataTemplate = template;
					(opt._templated = opt._templated || []).push(descriptor);
				}
			} else if (attrName === 'id')
				descriptor.id = value;
			else
				descriptor.setAttribute(attrName, value);
		})
	),

	tagContent: r()
		.rule('children')
		.rule('tagEnd')
};

rules = utils.merge(htmlRules, rules);

var parser = new Parser(rules, 'children');

parser.createDescriptor = function() {
	return new Virtual();
};

parser.toVirtual = function(string) {
	var descriptor = new Virtual();
	var ok = this.exec(string, descriptor, 'children', descriptor);
	if (ok === false || ok.length > 0)
		return false;

	descriptor.bind = function(context) {
		if (!this._templated)
			return
		for (var i = 0, len = this._templated.length; i < len; ++i)
			this._templated[i].dataTemplate.call(this._templated[i], context);
	}
	return descriptor;
}

module.exports = parser;
