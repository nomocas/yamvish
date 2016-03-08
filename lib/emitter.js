/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Event Emitter
 * 
 * Directly inspired from : https://github.com/jeromeetienne/microevent.js
 * Just remove mixins + add .once()
 */

var Emitter = function() {}
Emitter.prototype = {
	on: function(event, fct, args) {
		event = (typeof event === 'object' ? event.type : event);
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push({ fct: fct, args: args });
		return this;
	},
	off: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		var queue = this._events[event];
		for (var i = 0, len = queue.length; i < len; ++i)
			if (queue[i].fct === fct) {
				this._events[event].splice(i, 1);
				break;
			}
		return this;
	},
	once: function(event, func, args) {
		this._events = this._events || {};
		var handler = function() {
			this.off(event, handler);
			func.apply(this, arguments);
		};

		(this._events[event] = this._events[event] || []).push({ fct: handler, args: args });
		return this;
	},
	emit: function(event /* , args... */ ) {
		if (!this._events || (event in this._events === false) || !this._events[event].length)
			return this;
		var cloned = this._events[event].slice(),
			args = [].slice.call(arguments, 1);
		for (var i = 0, len = cloned.length; i < len; i++)
			cloned[i].fct.apply(this, cloned[i].args ? cloned[i].args.concat(args) : args);
		return this;
	}
};
module.exports = Emitter;
