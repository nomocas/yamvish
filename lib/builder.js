var Template = require('./template'),
	Context = require('./context'),
	dom = require('./output-engine/dom');

function Builder(node, context) {
	this._node = node;
	this.__yBuilder__ = true;
	if (context) {
		if (context.__yContext__)
			this._context = context;
		else
			this._context = new Context(context);
	}
	Template.call(this);
};

Builder.prototype = new Template();

function execHandler(node, handler, context) {
	var f;
	if (handler.engineBlock)
		f = handler.engineBlock.dom;
	else
		f = handler.func || dom[handler.name];
	f(node.context || context, node, handler.args);
}

Builder.prototype.exec = function(name, args, firstPass, suspendAfter) {
	Template.prototype.exec.call(this, name, args, firstPass, suspendAfter);
	execHandler(this._node, this._queue[this._queue.length - 1], this._context);
	return this;
};
Builder.prototype.dom = function(name, args, suspendAfter) {
	Template.prototype.dom.call(this, name, args, suspendAfter);
	execHandler(this._node, this._queue[this._queue.length - 1]);
	return this;
};
Builder.prototype.string = null;
Builder.prototype.firstPass = null;
Builder.prototype.secondPass = null;

module.exports = function(node, context) {
	return new Builder(node, context);
};
