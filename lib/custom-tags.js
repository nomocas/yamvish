var Template = require('./template'),
	Context = require('./context'),
	env = require('./env');
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



/**
 * style to do : work on bindable opts
 * @param {[type]} apiName        [description]
 * @param {[type]} tagName        [description]
 * @param {[type]} defaultAttrMap [description]
 * @param {[type]} templ          [description]
 */
module.exports = function addCustomTag(apiName, tagName, defaultAttrMap, templ) {
	var api = env.api,
		space = api[apiName] = api[apiName] || {};
	space[tagName] = function(attrMap, __yield) {
		// copy default to attrMap
		for (var i in defaultAttrMap)
			if (typeof attrMap[i] === 'undefined')
				attrMap[i] = defaultAttrMap[i];
		attrMap.__yield = __yield;
		return this.exec({
			dom: function(context) {
				var ctx = new Context({
					opts: attrMap
				}, context);
				var ctr = templ.toContainer(ctx).appendTo(this);
				ctr.context = ctx;
			},
			string: function(context, descriptor) {
				descriptor.children += templ.toHTMLString(new Context({
					opts: attrMap
				}, context));
			},
			twopass: {
				first: function(context) {
					(context.children = context.children || []).push(new Context({
						opts: attrMap
					}, context));
				},
				second: function(context, descriptor) {
					descriptor.children += templ.toHTMLString(context.children.shift());
				}
			}
		});
	}
	return this;
};
