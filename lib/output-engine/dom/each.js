/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * DOM only.
 */
var utils = require('../../utils'),
	Container = require('./container'),
	Context = require('../../context'),
	Switcher = require('./switcher');

var ID = 0;

// Template .each method for DOM handling
var each = function(context, node, args, parentContainer) {
	var eacher = new Each(context, node, args[1], args[2], parentContainer),
		data = args[0];

	if (typeof data === 'string') {
		node.binds = node.binds ||  [];
		eacher.varPath = data;
		var splitted = data.split('.');
		context.subscribe(data, function(value, type, path, index) {
			// console.log('eacher : data update : |%s|', type, value)
			switch (type) {
				case 'delete':
					eacher.updateArray([]);
					break;
				case 'reset':
				case 'set':
					eacher.updateArray(value);
					break;
				case 'push':
					console.log('PUSH !!! call pushitem')
					eacher.pushItem(value, index);
					break;
				case 'removeAt':
					eacher.deleteItem(index);
					break;
			}
		}, false, node.binds);
		context.subscribe(data + '.*', function(value, type, path, index) {
			// console.log('each data.* update : ', eacher.freezed, value, type, path, index)
			// if (eacher.freezed)
			// return;
			var p = path.slice(splitted.length);
			eacher.updateItem(type, p.slice(1), value, p[0], index);
		}, true, node.binds);
		data = context.get(data);
	}
	eacher.updateArray(data);
};


// Each : Class that inherits from Switcher and does items-list/empty management
var Each = function(context, node, itemTemplate, emptyTemplate, parentContainer) {
	this.itemTemplate = itemTemplate;
	this.itemsContainer = new Container();
	this.parentContainer = parentContainer;
	var templates = [{
		value: 'items',
		container: this.itemsContainer
	}];
	if (emptyTemplate)
		templates.push({
			value: 'empty',
			template: emptyTemplate
		});
	Switcher.call(this, context, node, parentContainer, templates);
};

Each.prototype = {
	_createItem: function(value, index) {
		var ctx = new Context(value, this.context),
			self = this,
			child = this.itemTemplate.toContainer(ctx, this.parentContainer);
		child.context = ctx;
		ctx.index = index;
		ctx.path = self.varPath + '.' + index;
		// do reverse 
		// ctx.subscribe('*', function(value, type, path, key) {
		// 	if (self.freezed)
		// 		return
		// 	if (!path.forEach)
		// 		path = path.split('.');
		// 	if (path[0] === '$this')
		// 		path = path.slice(1);
		// 	var fullPath = ctx.path;
		// 	if (path.length)
		// 		fullPath += '.' + path.join('.');
		// 	self.freezed = true;
		// 	self.context.notify(type, fullPath, value, key);
		// 	self.freezed = false;
		// }, true, ctx.binds);
		return child;
	},
	updateArray: function(array) {
		if (!array || !array.length) {
			this.switch('empty');
			if (this.itemsContainer)
				this.itemsContainer.empty();
			return;
		}
		this.switch('items');
		var items = this.itemsContainer.childNodes;

		// reset existing
		var i = 0,
			len = Math.min(items.length, array.length);
		for (; i < len; ++i)
			items[i].context.reset(array[i]);

		if (len < items.length) {
			// array has less elements than rendered items : remove items from i to items.length
			len = items.length;
			var start = i;
			for (; i < len; ++i)
				items[i].destroy();
			items.splice(start);
		} else if (len < array.length) {
			// array has more elements than rendered items : add new items from i to array.length
			var frag = this.itemsContainer.parentNode ? document.createDocumentFragment() : null;
			len = array.length;
			for (; i < len; ++i) {
				var item = this._createItem(array[i], i);
				items.push(item);
				if (frag)
					item.appendChildrenToFragment(frag, this.itemsContainer.parentNode);
			}
			if (frag)
				appendFragment(frag, this.itemsContainer.parentNode, this.itemsContainer.nextSibling || this.witness.nextSibling);
		}
	},
	updateItem: function(type, path, value, index, key) {
		var node = this.itemsContainer.childNodes[index];
		// console.log('each update item : ', node.context.path, path, node.context.data.title, value.title);
		if (node) {
			if (!path.length)
				node.context.set(value);
			else
				node.context.set(path, value)
				// this.freezed = true;
				// node.context.notify(type, path, value, key);
				// this.freezed = false;
		}
	},
	pushItem: function(data, index) {
		this.switch('items');
		var item = this._createItem(data, index),
			nextSibling = this.witness.nextSibling;
		if (this.itemsContainer.childNodes.length || !nextSibling)
			return this.itemsContainer.appendChild(item);
		if (nextSibling) {
			item.insertBeforeNode(nextSibling);
			this.itemsContainer.childNodes.push(item);
		}
		// console.log('item pushed : ', item);
	},
	deleteItem: function(index) {
		var node = this.itemsContainer.childNodes[index];
		node.doUnmount();
		var children = this.itemsContainer.childNodes;
		children.splice(index, 1);
		if (!children.length)
			this.switch('empty');
		else
			for (var i = index, len = children.length; i < len; ++i) {
				children[i].context.index = i;
				children[i].context.path = this.varPath + '.' + i;
			}
	}
};

function appendFragment(frag, parent, nextSibling) {
	if (nextSibling)
		parent.insertBefore(frag, nextSibling);
	else
		parent.appendChild(frag);
}

utils.shallowMerge(Switcher.prototype, Each.prototype);

module.exports = {
	Each: Each,
	each: each
};
