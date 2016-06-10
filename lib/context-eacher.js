/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * dedicated context's collection manager.
 */
var utils = require('./utils'),
	Emitter = require('nomocas-utils/lib/emitter'),
	Context = require('./context').Context;

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
		}
		this.emit('updateItem', ctx);
	},
	pushItem: function(data, noEmit) {
		var ctx = new Context(data, this.parent),
			index = this.children.length;
		ctx.index = index;
		ctx.path = this.path + '.' + index;
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
		for (var i = index, len = this.children.length; i < len; ++i) {
			ctx = this.children[i];
			ctx.index = i;
			ctx.path = this.path + '.' + i;
		}
		this.emit('deleteItem', index);
	},
	displaceItem: function(indexes /* { fromIndex, toIndex } */ ) {
		var ctx = this.children[indexes.fromIndex];
		if (!ctx)
			return;
		this.children.splice(indexes.fromIndex, 1);
		this.children.splice(indexes.toIndex, 0, ctx);
		var start = Math.min(indexes.fromIndex, indexes.toIndex),
			child;
		for (var i = start, len = this.children.length; i < len; ++i) {
			child = this.children[i];
			child.index = i;
			child.path = this.path + '.' + i;
		}
		this.emit('displaceItem', ctx, indexes);
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
