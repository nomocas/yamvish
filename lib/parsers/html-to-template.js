/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	utils = require('../utils.js'),
	Template = require('../template.js'),
	expression = require('./expression'),
	htmlRules = require('./html-common-rules');

var rules = {
	// tag children
	children: r()
		.zeroOrMore(null,
			r().oneOf([
				r().space().rule('comment').skip(),
				r().space().rule('tag'),
				r().rule('text')
			])
		),

	text: r().regExp(/^[^<]+/, false, function(descriptor, cap) {
		descriptor.text(cap[0]);
	}),

	tag: r()
		.regExp(/^<([\w-_]+)\s*/, false, function(descriptor, cap) {
			descriptor.tagName = cap[1].toLowerCase();
		})
		.done(function(string, descriptor) {
			descriptor._attributesTemplate = new Template();
			return this.exec(string, descriptor._attributesTemplate, this.rules.attributes);
		})
		.oneOf([
			r().char('>')
			.done(function(string, descriptor) {
				// check html5 unstrict self-closing tags
				if (this.rules.openTags.test(descriptor.tagName))
					return string; // no children

				if (descriptor.tagName === 'script') // get script content
					return this.exec(string, descriptor, this.rules.innerScript);

				// get inner tag content
				descriptor._eachTemplate = new Template();
				var ok = this.exec(string, descriptor._eachTemplate, this.rules.children); // to _eachTemplate
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, descriptor, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, descriptor) {
			var eachTemplate = descriptor._eachTemplate,
				attributesTemplate = descriptor._attributesTemplate;
			if (eachTemplate)
				if (!attributesTemplate._hasEach)
					attributesTemplate._queue = attributesTemplate._queue.concat(eachTemplate._queue);
				else
					attributesTemplate._queue.unshift({
						// small hack to define _eachTemplate in virtual or DOM element before 'each' execution
						type: 'done',
						fn: function(string) {
							this._eachTemplate = eachTemplate;
							return string;
						}
					});
			descriptor.tag(descriptor.tagName, attributesTemplate);
			delete descriptor._attributesTemplate;
			delete descriptor._eachTemplate;
			delete descriptor.tagName;
			return string;
		}),

	attributes: r().zeroOrMore(null,
		r().regExp(/^([\w-_]+)\s*(?:=(?:"([^"]*)"|([\w-_]+)))?\s*/, false, function(descriptor, cap) {
			var attrName = cap[1],
				value = (cap[2] !== undefined) ? cap[2] : ((cap[3] !== undefined) ? cap[3] : '');

			switch (attrName) {
				case 'class':
					if (!value)
						break;
					value.split(/\s+/).forEach(function(cl) {
						descriptor.setClass(cl);
					});
					break;
				case 'data-template':
					if (!value)
						break;
					var template = expression.parseTemplate(value);
					if (template !== false) {
						descriptor._queue = descriptor._queue.concat(template._queue);
						descriptor._hasEach = descriptor._hasEach || template._hasEach;
					} else
						throw new Error('data-template attribute parsing failed : ' + value);
					break;
				case 'id':
					if (!value)
						break;
					descriptor.id(value);
					break;
				default:
					descriptor.attr(attrName, value);
					break;
			}
		})
	)
};

rules = utils.merge(htmlRules, rules);

var parser = new Parser(rules, 'children');

parser.createDescriptor = function() {
	return new Template();
};

module.exports = parser;
