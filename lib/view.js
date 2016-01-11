var Template = require('./template');

function View(data, parent, path) {
	this.__yView__ = true;
	Template.call(this);
	this.context(data, parent, path)
		.exec(function(context) {
			context.viewData = {};
		}, null, true)
		.exec(function(context, container) {
			context.viewData.container = container;
		});
};

View.prototype = new Template();

// kill all attributes related metods
['attr', 'css', 'setClass', 'cl', 'visible', 'disabled', 'val']
.forEach(function(method) {
	View.prototype[method] = null;
});

module.exports = View;
