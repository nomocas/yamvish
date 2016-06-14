/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * dedicated context's collection manager.
 */
var utils = require('./utils'),
	Emitter = require('nomocas-utils/lib/emitter'),
	Context = require('./context').Context;

function resetIndexAndPath(ctxEacher, start) {
	for (var i = start, len = ctxEacher.children.length, child; i < len; ++i) {
		child = ctxEacher.children[i];
		child.index = i;
		child.path = ctxEacher.path + '.' + i;
	}
}

var EachContext = function(context, data, initialiser) {
	this.parent = context;
	this.children = [];
	if (typeof data === 'string') {
		var self = this,
			path = this.path = data;
		context.subscribe(data, function(value, type, p, index) {
			// console.log('each context : data update : ', type, value, path, p, index);
			switch (type) {
				case 'set':
					if (!p.length)
						self.updateArray(value);
					else
						self.updateItem(type, p, value, index);
					break;
				case 'push':
					if (!p.length)
						self.pushItem(value);
					else
						self.updateItem(type, p, value, index); //type, path, value, index
					break;
				case 'displaceItem':
					if (!p.length)
						self.displaceItem(value);
					else
						self.updateItem(type, p, value, index); //type, path, value, index
					break;
				case 'insertItem':
					if (!p.length)
						self.insertItem(value);
					else
						self.updateItem(type, p, value, index); //type, path, value, index
					break;
				case 'delete':
					if (!p.length)
						self.updateArray([]);
					else if (p.length === 1)
						self.deleteItem(index);
					else
						self.updateItem(type, p, value, index); // type, path, value, index
					break;
			}
		}, true);
		data = context.get(data);
	}
	this.updateArray(data);
	if (initialiser)
		initialiser(this, context);
};

EachContext.prototype = new Emitter();

var proto = {
	getItem: function(index) {
		return this.children[index];
	},
	createItem: function(data) {
		var ctx = new Context(data, this.parent),
			index = this.children.length;
		ctx.index = index;
		ctx.path = this.path + '.' + index;
		return ctx;
	},
	updateArray: function(array) {
		// console.log('each context : update array : ', this.path, this.children.length, array);
		var items = this.children,
			i = 0,
			start,
			len = array ? Math.min(items.length, array.length) : 0;
		// reset existing
		for (; i < len; ++i)
			items[i].reset(array[i], true);

		if (len < items.length) {
			// array has less elements than actual items : remove items from i to items.length
			len = items.length;
			start = i;
			for (; i < len; ++i)
				items[i].destroy();
			this.children = items.slice(0, start);
			this.emit('updateArray', 'less', items.slice(start));

		} else if (array && len < array.length) {
			// array has more elements than actual items : add new items from i to array.length
			len = array.length;
			start = i;
			for (; i < len; ++i)
				this.pushItem(array[i], true);
			this.emit('updateArray', 'more', items.slice(start));

		} else
			this.emit('updateArray', 'equal', []);
	},
	updateItem: function(type, path, value, index) {
		var ctx = this.children[index];
		if (!ctx)
			return;
		// console.log('each context : update item : ', type, path, ctx.path, value, index);
		switch (type) {
			case 'set':
				if (path.length === 1)
					ctx.reset(value, true);
				else
					ctx.set(path, value, true);
				break;
			case 'delete':
				ctx.del(path, true);
				break;
			case 'push':
				ctx.push(path, value, true);
				break;
			case 'deleteItem':
				ctx.deleteItem(path, value, true);
				break;
			case 'displaceItem':
				ctx.displaceItem(path, value, true);
				break;
			case 'insertItem':
				ctx.insertItem(path, value, true);
				break;
		}
		this.emit('updateItem', ctx);
	},
	pushItem: function(data, noEmit) {
		var ctx = this.createItem(data);
		this.children.push(ctx);
		if (!noEmit)
			this.emit('pushItem', ctx);
	},
	deleteItem: function(index) {
		var ctx = this.children[index];
		if (!ctx)
			return;
		ctx.destroy();
		this.children.splice(index, 1);
		resetIndexAndPath(this, index);
		this.emit('deleteItem', index);
	},
	displaceItem: function(indexes /* { fromIndex, toIndex } */ ) {
		var ctx = this.children[indexes.fromIndex];
		if (!ctx)
			return;
		var fromIndex = indexes.fromIndex,
			toIndex = indexes.toIndex;
		this.children.splice(fromIndex, 1);
		this.children.splice(toIndex, 0, ctx);
		resetIndexAndPath(this, Math.min(fromIndex, toIndex));
		this.emit('displaceItem', ctx, fromIndex, toIndex);
	},
	insertItem: function(opt /* { data, index } */ ) {
		var ctx = this.createItem(opt.data);
		this.children.splice(opt.index, 0, ctx);
		resetIndexAndPath(this, opt.index);
		this.emit('insertItem', ctx, opt.index);
	}
};
Context.prototype.getEacher = function(path) {
	this._eachers = this._eacher || {};
	if (!this._eachers[path])
		this._eachers[path] = new EachContext(this, path);
	return this._eachers[path];
};

utils.shallowMerge(proto, EachContext.prototype);

module.exports = EachContext;
