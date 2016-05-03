/** 
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * for parsing html5 to yamvish template.
 */

var elenpi = require('elenpi'),
	r = elenpi.r,
	Parser = elenpi.Parser,
	Template = require('../template'),
	expression = require('./string-to-template'), // for data-template attribute parsing
	api = require('../api'),
	attributeExpr = /^([\w-_]+)\s*(?:=\s*("([^"]*)"|[\w-_]+|\{\{[^\}]+\}\}|\{[^\}]+\}))?\s*/,
	yamTagWithPath = /if|each|with|mountIf/,
	yamTagWithoutPath = /client|server|view|container/,
	yamAPITag = /^[\w\.\$_-]+:[\w\.\$_-]+/,
	yamTags = new RegExp('^<(' + yamTagWithPath.source + '|' + yamTagWithoutPath.source + '|' + yamAPITag.source + ')\\s*'),
	openTags = require('./open-tags'), // html5 unstrict self closing tags 
	rawContentTags = /^(?:script|style|code|templ)/;

// raw inner content of tag
function rawContent(tagName, string, templ, innerTemplate) {
	var index = string.indexOf('</' + tagName + '>'),
		raw;
	if (index === -1)
		throw new Error(tagName + ' tag badly closed.');
	if (index) { // more than 0
		raw = string.substring(0, index);
		if (tagName === 'templ') // produce local api-like handler
		{
			innerTemplate.templFunc = new Function(raw);
		} else
			innerTemplate.raw(raw);
	}
	return string.substring(index + tagName.length + 3);
}

var rules = {

	document: r()
		.zeroOrMore(null, r().space().rule('comment'))
		.regExp(/^\s*<!DOCTYPE[^>]*>\s*/i, true)
		.rule('children')
		.space(),

	comment: r().regExp(/^<!--(?:.|\s)*?(?=-->)-->/, false, function() {}),

	tagEnd: r()
		// closing tag
		.regExp(/^\s*<\/([\w:-_]+)\s*>/, false, function(templ, cap) {
			if (templ.tagName !== cap[1])
				throw new Error('tag badly closed : ' + cap[1] + ' - (at opening : ' + templ.tagName + ')');
		}),

	// tag children
	children: r()
		.zeroOrMore(null,
			r().oneOf([
				r().space().rule('comment'),
				r().space().rule('yamTag'),
				r().space().rule('tag'),
				r().rule('text')
			])
		),

	text: r()
		// .regExp(/^\s+/, true, function(templ) {
		// 	templ.text(' ');
		// })
		.regExp(/^[^<]+/, false, function(templ, cap) {
			templ.text(cap[0]);
		}),

	// normal tag (including raw tags and so also special yamvish templ tag)
	tag: r()
		.regExp(/^<([\w-_]+)\s*/, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.done(function(string, templ) {
			templ._innerTemplate = new Template();
			return this.exec(string, templ._innerTemplate, this.rules.attributes);
		})
		.oneOf([
			r().char('>')
			.done(function(string, templ) {
				// check html5 unstrict self-closing tags
				if (openTags.test(templ.tagName))
					return string; // no children

				if (rawContentTags.test(templ.tagName)) // get raw content
					return rawContent(templ.tagName, string, templ, templ._innerTemplate);

				// get inner tag content
				var ok = this.exec(string, templ._innerTemplate, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, templ, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, templ) {
			if (templ.tagName === 'yield')
				templ.tagName = '__yield';
			if (templ.tagName !== 'templ')
				templ.tag(templ.tagName, templ._innerTemplate);
			else
				templ.use(templ._innerTemplate.templFunc);

			templ._innerTemplate = null;
			templ.tagName = null;
			return string;
		}),

	// yamvish special tags path arguments
	yamTagPath: r().regExp(/^([\w-_$]+|\{{1,2}[^\}]*\}{1,2})/, false, function(templ, cap) {
		templ.path = cap[1];
	}),

	yamTag: r() // yamvish special tags
		.regExp(yamTags, false, function(templ, cap) {
			templ.tagName = cap[1];
		})
		.done(function(string, templ) {
			var attrMap = {};
			templ.attrMap = attrMap;
			if (templ.tagName.match(yamTagWithPath))
				return this.exec(string, attrMap, this.rules.yamTagPath);
			else if (templ.tagName.match(yamTagWithoutPath))
				return string;
			// api tag : catch normal attr
			return this.exec(string, attrMap, this.rules.attributesMap);
		})
		.space()
		.oneOf([
			r().char('>')
			.done(function(string, templ) {
				// get inner tag content
				var t = templ._innerTemplate = new Template(),
					ok = this.exec(string, t, this.rules.children);
				if (ok === false)
					return false;
				// close tag
				return this.exec(ok, templ, this.rules.tagEnd);
			}),
			// strict self closed tag
			r().regExp(/^\/>/)
		])
		.done(function(string, templ) {
			var tagName = templ.tagName,
				attrMap = templ.attrMap,
				_yield = templ._innerTemplate;

			switch (tagName) {
				case 'if':
				case 'each':
				case 'with':
				case 'mountIf':
					templ[tagName](attrMap.path, _yield);
					break;
				case 'client':
				case 'server':
				case 'view':
				case 'container':
					templ[tagName](_yield);
					break;
				default: // api tag
					templ.use(tagName, attrMap, _yield);
			}
			templ._innerTemplate = null;
			templ.attrMap = null;
			templ.tagName = null;
			return string;
		}),

	attributesMap: r() // attributes to attrMap for api tags
		.zeroOrMore(null,
			r().regExp(attributeExpr, false, function(descriptor, cap) {
				descriptor[cap[1]] = (cap[3] !== undefined) ? cap[3] : ((cap[2] !== undefined) ? cap[2] : '');
			})
			.space()
		),

	attributes: r() // attributes to template for normal tags
		.zeroOrMore(null,
			// attrName | attrName="... ..." | attrName=something | attrName={{ .. }} | attrName={ .. }
			// with an optional space (\s*) after equal sign (if any).
			r().regExp(attributeExpr, false, function(templ, cap) {
				var attrName = cap[1],
					value = (cap[3] !== undefined) ? cap[3] : ((cap[2] !== undefined) ? cap[2] : '');

				switch (attrName) {
					case 'class':
						if (!value)
							break;
						value.split(/\s+/).forEach(function(cl) {
							templ.cl(cl);
						});
						break;
					case 'data-template':
						if (!value)
							break;
						var template = expression.parseTemplate(value);
						if (template !== false)
							templ._queue = templ._queue.concat(template._queue);
						else
							throw new Error('data-template attribute parsing failed : ' + value);
						break;
					default:
						templ.attr(attrName, value);
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


/*

var html = `
<div id="e2">
<templ>this.p("zeClick")</templ>
<if {{ foo }}>hello world</if>
<each items><span>{{ $this }}</span></each>
</div>


<test:hello id={{ bar }}>
  <test:hello id="e3" />
  hello api world
</test:hello>
`;
var templ, res = '';

y.api.test = {
  hello:function(attrMap, _yield){
    return this.section(attrMap, _yield);
  }
};

templ = y.html.parse(html);


var ctx = new y.Context({ bar:"dynID", foo:true, items:['ho', 'yeah'], zeClick:function(){ console.log('zeeee clickkkk!!'); } });

if(templ)
  res = templ.toHTMLString(ctx);

res


//templ




 */
