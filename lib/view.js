/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var utils = require('./utils'),
	Template = require('./template'),
	Virtual = require('./virtual'),
	Container = require('./container'),
	Context = require('./context');
//____________________________________________________ VIEW
var View = function View(opt) {
	opt = opt || {};
	if (opt.componentName)
		addComponent(opt.componentName, this);
	this.factory = opt.factory;
	Context.call(this, opt);
	Container.call(this, opt);
}
utils.mergeProto(Template.prototype, View.prototype);
utils.mergeProto(Context.prototype, View.prototype);
utils.mergeProto(Container.prototype, View.prototype);
View.prototype.done = function(fn) {
	fn.call(this, this, this.factory || (utils.isServer ? Virtual : document)); // apply directly toElement handler on this
	return this;
};
View.prototype.destroy = function() {
	Container.prototype.destroy.call(this);
	Context.prototype.destroy.call(this);
};
delete View.prototype['catch'];
delete View.prototype.call;
delete View.prototype.toElement;
delete View.prototype.id;
delete View.prototype.attr;
delete View.prototype.setClass;
delete View.prototype.visible;
delete View.prototype.css;
delete View.prototype.val;
delete View.prototype.contentEditable;

module.exports = View;
