var Template = require('./template'),
	api = require('./api'),
	Context = require('./context');
/**
 * use current customTag content
 * @return {Template} current template
 */
Template.prototype.__yield = function() {
	return this.exec({
		dom: function(context, node) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			return templ.call(node, context);
		},
		string: function(context, descriptor) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			descriptor.children += templ.toHTMLString(context);
		}
	});
};


var customTags = {
	dom: function(context, node, args, container) {
		var ctx = new Context({
			opts: args[0]
		}, context);
		var ctr = args[1].toContainer(ctx, container).appendTo(this);
		ctr.context = ctx;
	},
	string: function(context, descriptor, args) {
		descriptor.children += args[1].toHTMLString(new Context({
			opts: args[0]
		}, context));
	},
	firstPass: function(context, args) {
		(context.children = context.children || []).push(new Context({
			opts: args[0]
		}, context));
	},
	secondPass: function(context, descriptor, args) {
		descriptor.children += args[1].toHTMLString(context.children.shift());
	}
};

/**
 * addCustomTag in specified api.
 * @param {[type]} apiName        [description]
 * @param {[type]} tagName        [description]
 * @param {[type]} defaultAttrMap [description]
 * @param {[type]} templ          [description]
 */
module.exports = function(apiName, tagName, defaultAttrMap, templ) {
	var space = api[apiName] = api[apiName] || {};
	space[tagName] = function(attrMap, __yield) {
		// copy default to attrMap
		for (var i in defaultAttrMap)
			if (typeof attrMap[i] === 'undefined')
				attrMap[i] = defaultAttrMap[i];
		attrMap.__yield = __yield;
		var args = [attrMap, templ];
		return this.exec(customTags, args);
	}
	return this;
};
