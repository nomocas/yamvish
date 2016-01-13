var Template = require('./template'),
	api = require('./api'),
	Context = require('./context');
/**
 * use current customTag content
 * @return {[type]} [description]
 */
Template.prototype.__yield = function() {
	return this.exec({
		dom: function(context) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			return templ.call(this, context);
		},
		string: function(context, descriptor) {
			var templ = context.data.opts && context.data.opts.__yield;
			if (!templ)
				return;
			descriptor.children += templ.toHTMLString(context);
		}
	});
};

var customTagEngine = {
	dom: function(context, args) {
		var ctx = new Context({
			opts: args[0]
		}, context);
		var ctr = args[1].toContainer(ctx).appendTo(this);
		ctr.context = ctx;
	},
	string: function(context, descriptor, args) {
		descriptor.children += args[1].toHTMLString(new Context({
			opts: args[0]
		}, context));
	},
	twopass: {
		first: function(context, args) {
			(context.children = context.children || []).push(new Context({
				opts: args[0]
			}, context));
		},
		second: function(context, descriptor, args) {
			descriptor.children += args[1].toHTMLString(context.children.shift());
		}
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
		return this.exec(customTagEngine, [attrMap, templ]);
	}
	return this;
};
