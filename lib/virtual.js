/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Emitter = require('./emitter'),
	PureNode = require('./pure-node'),
	openTags = require('./parsers/open-tags');

//_______________________________________________________ VIRTUAL NODE

/**
 * Virtual Node
 *
 * A minimal mock of DOMElement. It gathers PureNode and Emitter API and add attributes management (add and remove).
 * 
 * @param {Object} option (optional) option object : { ?tagName:String, ?nodeValue:String } + options from PureNode
 */
function Virtual(opt /*tagName, context*/ ) {
	opt = opt || {};
	this.__yVirtual__ = true;
	if (opt.tagName)
		this.tagName = opt.tagName;
	if (opt.nodeValue)
		this.nodeValue = opt.nodeValue;
	PureNode.call(this, opt);
};

Virtual.prototype  = {
	setAttribute: function(name, value) {
		(this.attributes = this.attributes || {})[name] = value;
	},
	removeAttribute: function(name, value) {
		if (!this.attributes)
			return;
		delete this.attributes[name];
	}
};

// apply inheritance
utils.mergeProto(PureNode.prototype, Virtual.prototype);
utils.mergeProto(Emitter.prototype, Virtual.prototype);

/**
 * Virtual to String output
 * @return {String} the String representation of Virtual node
 */
Virtual.prototype.toString = function() {
	if (this.tagName === 'textnode')
		return this.nodeValue;
	var node = '<' + this.tagName;
	if (this.id)
		node += ' id="' + this.id + '"';
	for (var a in this.attributes)
		node += ' ' + a + '="' + this.attributes[a] + '"';
	if (this.classes) {
		var classes = Object.keys(this.classes);
		if (classes.length)
			node += ' class="' + classes.join(' ') + '"';
	}
	if (this.childNodes && this.childNodes.length) {
		node += '>';
		for (var j = 0, len = this.childNodes.length; j < len; ++j)
			node += this.childNodes[j].toString();
		node += '</' + this.tagName + '>';
	} else if (this.scriptContent)
		node += '>' + this.scriptContent + '</script>';
	else if (openTags.test(this.tagName))
		node += '>';
	else
		node += ' />';
	return node;
};


// Virtual Factory : mimic document.createElement but return a virtual node
Virtual.createElement = function(tagName) {
	return new Virtual({
		tagName: tagName
	});
};

// Virtual Factory : mimic document.createTextNode but return a virtual node
Virtual.createTextNode = function(value) {
	return new Virtual({
		tagName: 'textnode',
		nodeValue: value
	})
};

module.exports = Virtual;
