/**  @author Gilles Coomans <gilles.coomans@gmail.com> */
// var expression = require('./string-to-template');
//_______________________________________________________ DOM PARSING

/**
 * DOM element.childNodes parsing to y.Template
 * @param  {[type]} element [description]
 * @param  {[type]} template   [description]
 * @return {[type]}         [description]
 */
function elementChildrenToTemplate(element, template) {
	var t = template || new this.Template();
	for (var i = 0, len = element.childNodes.length; i < len; ++i)
		elementToTemplate(element.childNodes[i], t);
	return t;
};

/**
 * DOM element parsing to y.Template
 * @param  {[type]} element [description]
 * @param  {[type]} template   [description]
 * @return {[type]}         [description]
 */
function elementToTemplate(element, template) {
	var t = template || y();
	switch (element.nodeType) {
		case 1:
			// if (element.tagName.toLowerCase() === 'script')
			// console.log('CATCH script');
			var childTemplate = new this.Template();
			elementChildrenToTemplate(element, childTemplate);
			if (element.id)
				childTemplate.id(element.id)
			if (element.attributes.length)
				for (var j = 0, len = element.attributes.length; j < len; ++j) {
					var o = element.attributes[j];
					if (o.name === 'data-template')
						console.log("catch data template")
					childTemplate.attr(o.name, o.value);
				}
			for (var l = 0; l < element.classList; ++l)
				childTemplate.setClass(element.classList[l]);
			t.tag.apply(t, [element.tagName.toLowerCase(), childTemplate]);
			break;
		case 3:
			t.text(element.textContent);
			break;
		case 4:
			console.log('element is CDATA : ', element);
			break;
		default:
			console.warn('y.elementToTemplate : DOM node not managed : type : %s, ', element.nodeType, element);
	}
	return t;
};

module.exports = {
	elementChildrenToTemplate: elementChildrenToTemplate,
	elementToTemplate: elementToTemplate
};
