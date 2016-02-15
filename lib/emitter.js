/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

/**
 * Event Emitter
 * 
 * Directly inspired from : https://github.com/jeromeetienne/microevent.js
 * Just remove mixins + add .once()
 */

var Emitter = function() {}
Emitter.prototype = {
	on: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		this._events = this._events || {};
		(this._events[event] = this._events[event] || []).push(fct);
		return this;
	},
	off: function(event, fct) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	once: function(event, func) {
		var self = this;
		this._events = this._events || {};
		var handler = function(evt) {
			self.off(event, func);
			func.call(this, evt);
		};

		(this._events[event] = this._events[event] || []).push(handler);
		return this;
	},
	emit: function(event /* , args... */ ) {
		event = (typeof event === 'object' ? event.type : event);
		if (!this._events || (event in this._events === false))
			return this;
		var cloned = this._events[event].slice(),
			args = [].slice.call(arguments, 1);
		for (var i = 0, len = cloned.length; i < len; i++)
			cloned[i].apply(this, args);
		return this;
	}
};
module.exports = Emitter;
