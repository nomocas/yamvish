/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	expression = require('./string-to-template');

var rules = {
	// HTML 5 common rules
	// html5 unstrict self closing tags : 
	openTags: require('./open-tags'),

	document: r()
		.zeroOrMore(null, r().space().rule('comment'))
		.regExp(/^\s*<!DOCTYPE[^>]*>\s*/i, true)
		.rule('children')
		.space(),

	comment: r().regExp(/^<!--(?:.|\n|\r)*?(?=-->)-->/),

	tagEnd: r()
		// closing tag
		.regExp(/^\s*<\/([\w-_]+)\s*>/, false, function(descriptor, cap) {
			if (descriptor.tagName !== cap[1].toLowerCase())
				throw new Error('tag badly closed : ' + cap[1] + ' - (at opening : ' + descriptor.tagName + ')');
		}),

	innerScript: r()
		.done(function(string, descriptor) {
			var index = string.indexOf('</script>');
			if (index === -1)
				throw new Error('script tag badly closed.');
			if (index)
				descriptor.scriptContent = string.substring(0, index);
			return string.substring(index + 9);
		}),
	// END common rules

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
		// 
		.regExp(/^<([\w-_]+)\s*/, false, function(descriptor, cap) {
			descriptor.tagName = cap[1].toLowerCase();
		})
		// 	.done(function(string, descriptor) {
		// 		switch (descriptor.tagName) {
		// 			case 'if': // <if {{  }}>  attr:   {{ xpr }}
		// 				break;
		// 			case 'each':
		// 				break;
		// 			case 'with':
		// 				break;
		// 			case 'client':
		// 				break;
		// 			case 'server':
		// 				break;
		// 			default:
		// 				// test custom tags

	// 				// else : normal tag
	// 		}
	// 	}),

	// normalTag: r()
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
				descriptor._innerTemplate = new Template();
				var ok = this.exec(string, descriptor._innerTemplate, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, descriptor, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, descriptor) {
			var innerTemplate = descriptor._innerTemplate,
				attributesTemplate = descriptor._attributesTemplate;
			if (innerTemplate)
				attributesTemplate._queue = attributesTemplate._queue.concat(innerTemplate._queue);
			descriptor.tag(descriptor.tagName, attributesTemplate);
			descriptor._attributesTemplate = null;
			descriptor._innerTemplate = null;
			descriptor.tagName = null;
			return string;
		}),

	attributes: r().zeroOrMore(null,
		// attrName | attrName="... ..." | attrName=something
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
					if (template !== false)
						descriptor._queue = descriptor._queue.concat(template._queue);
					else
						throw new Error('data-template attribute parsing failed : ' + value);
					break;
					// case 'style':
				default:
					descriptor.attr(attrName, value);
					break;
			}
		})
	)
};

var parser = new Parser(rules, 'children');

parser.createDescriptor = function() {
	return new Template();
};

module.exports = parser;
