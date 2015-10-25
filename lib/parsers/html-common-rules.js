/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Common HTML5 elenpi rules use din both html-to-template and html-to-virtual parsers
 * @type {[type]}
 */
var r = require('elenpi').r; // elenpi new rule shortcut

var rules = {
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
			if (index == -1)
				throw new Error('script tag badly closed.');
			if (index)
				descriptor.scriptContent = string.substring(0, index);
			return string.substring(index + 9);
		})
};

module.exports = rules;
