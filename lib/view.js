/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Template = require('./template'),
	Container = require('./container'),
	Context = require('./context');
//____________________________________________________ VIEW
var View = function View(opt) {
	this.__yView__ = true;
	opt = opt || {};
	if (opt.componentName)
		addComponent(opt.componentName, this);
	Context.call(this, opt);
	Container.call(this, opt.parent);
};
utils.mergeProto(Template.prototype, View.prototype);
utils.mergeProto(Container.prototype, View.prototype);
utils.mergeProto(Context.prototype, View.prototype);
View.prototype.exec = function(fn) {
	var p = fn.call(this, this, this); // apply directly toElement handler on this
	if (p && p.then)
		this.waiting(p);
	return this;
};
View.prototype.destroy = function() {
	Container.prototype.destroy.call(this);
	Context.prototype.destroy.call(this);
};
// remove API that does not make sens with view
// view is directly constructed : no call, catch, or toElement
delete View.prototype.call;
delete View.prototype.toElement;
// view is a context : could not change it
delete View.prototype.context;
// view is a container : no attributes
delete View.prototype.attr;
delete View.prototype.setClass;
delete View.prototype.visible;
delete View.prototype.css;
delete View.prototype.val;
delete View.prototype.contentEditable;

module.exports = View;
