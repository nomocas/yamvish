/**
 * A reimplmentation RQL for JavaScript arrays based on rql/js-array from Kris Zyp (https://github.com/persvr/rql).
 * No more eval or new Function.
 * It handle also dotted notation for properties path.
 * @example
 * rql([{a:{b:3}},{a:3}], "a.b=3") -> [{a:{b:3}]
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
(function() {
	"use strict";
	var parser = require('rql/parser');

	function inArray(what, inArr) {
		if (!inArr || !inArr.forEach)
			return false;
		if (what.forEach) {
			var test = {};
			inArr.forEach(function(e) {
				test[e] = true;
			});
			var okCount = 0;
			what.forEach(function(e) {
				if (test[e])
					okCount++;
			});
			if (okCount == what.length)
				return true;
			return false;
		}
		return inArr.some(function(e) {
			return what === e;
		});
	};


	var rqlParser = parser.parseQuery;

	var queryCache = {};

	var rql = function(array, query) {
		if (query[0] == "?")
			query = query.substring(1);
		if (queryCache[query])
			return queryCache[query].call(array);
		return rql.compile(query).call(array);
	};

	rql.parse = function(input) {
		try {
			var r = rqlParser(input);
			r.toString = function() {
				return input;
			};
			return r;
		} catch (e) {
			return null;
		}
	};

	rql.compile = function(query) {
		var parsed = rql.parse(query);
		var func = rqlNodeToFunc(parsed);
		queryCache[query] = func;
		return func;
	};

	rql.ops = {
		isPresent: function(path, items) {
			var res = [];
			var len = items.length;
			for (var i = 0; i < len; ++i)
				if (retrieve(items[i], path))
					res.push(items[i]);
			return res;
		},
		sort: function() {
			var terms = [];
			for (var i = 0; i < arguments.length; i++) {
				var sortAttribute = arguments[i];
				var firstChar = sortAttribute.charAt(0);
				var term = {
					attribute: sortAttribute,
					ascending: true
				};
				if (firstChar == "-" || firstChar == "+") {
					if (firstChar == "-")
						term.ascending = false;
					term.attribute = term.attribute.substring(1);
				}
				terms.push(term);
			}
			this.sort(function(a, b) {
				for (var term, i = 0; term = terms[i]; i++) {
					var ar = retrieve(a, term.attribute);
					var br = retrieve(b, term.attribute);
					if (ar != br)
						return term.ascending == ar > br ? 1 : -1;
				}
				return 0;
			});
			return this;
		},
		match: filter(function(value, regex) {
			return new RegExp(regex).test(value);
		}),
		"in": filter(function(value, values) {
			var ok = false;
			var count = 0;
			while (!ok && count < values.length)
				if (values[count++] == value)
					ok = true;
			return ok;
		}),
		out: filter(function(value, values) {
			var ok = true;
			var count = 0;
			while (ok && count < values.length)
				if (values[count++] == value)
					ok = false;
			return ok;
		}),
		contains: filter(function(array, value) {
			return inArray(value, array);
		}),
		excludes: filter(function(array, value) {
			return !inArray(value, array);
		}),
		or: function() {
			var items = [];
			//TODO: remove duplicates and use condition property
			for (var i = 0; i < arguments.length; ++i) {
				var a = arguments[i];
				if (typeof a == 'function')
					items = items.concat(a.call(this));
				else
					items = items.concat(rql.ops.isPresent(a, items));
			}
			return items;
		},
		and: function() {
			var items = this;
			for (var i = 0; i < arguments.length; ++i) {
				var a = arguments[i];
				if (typeof a == 'function')
					items = a.call(items);
				else
					items = rql.ops.isPresent(a, items);
			}
			return items;
		},
		select: function() {
			var args = arguments;
			var argc = arguments.length;
			var res = this.map(function(object) {
				var selected = {};
				for (var i = 0; i < argc; i++) {
					var propertyName = args[i];
					var value = evaluateProperty(object, propertyName);
					if (typeof value != "undefined")
						selected[propertyName] = value;
				}
				return selected;
			});
			return res;
		},
		/* _______________________________________________ WARNING : NOT IMPLEMENTED WITH PREFIX*/
		unselect: function() {
			var args = arguments;
			var argc = arguments.length;
			return this.map(function(object) {
				var selected = {};
				for (var i in object)
					if (object.hasOwnProperty(i))
						selected[i] = object[i];
				for (var i = 0; i < argc; i++)
					delete selected[args[i]];
				return selected;
			});
		},
		values: function(first) {
			if (arguments.length == 1)
				return this.map(function(object) {
					return retrieve(object, first);
				});
			var args = arguments;
			var argc = arguments.length;
			return this.map(function(object) {
				var realObject = retrieve(object);
				var selected = [];
				if (argc === 0) {
					for (var i in realObject)
						if (realObject.hasOwnProperty(i))
							selected.push(realObject[i]);
				} else
					for (var i = 0; i < argc; i++) {
						var propertyName = args[i];
						selected.push(realObject[propertyName]);
					}
				return selected;
			});
		},
		limit: function(limit, start, maxCount) {
			var totalCount = this.length;
			start = start || 0;
			var sliced = this.slice(start, start + limit);
			if (maxCount) {
				sliced.start = start;
				sliced.end = start + sliced.length - 1;
				sliced.totalCount = Math.min(totalCount, typeof maxCount === "number" ? maxCount : Infinity);
			}
			return sliced;
		},
		distinct: function() {
			var primitives = {};
			var needCleaning = [];
			var newResults = this.filter(function(value) {
				value = retrieve(value);
				if (value && typeof value == "object") {
					if (!value.__found__) {
						value.__found__ = function() {}; // get ignored by JSON serialization
						needCleaning.push(value);
						return true;
					}
					return false;
				}
				if (!primitives[value]) {
					primitives[value] = true;
					return true;
				}
				return false;
			});
			needCleaning.forEach(function(object) {
				delete object.__found__;
			});
			return newResults;
		},
		recurse: function(property) {
			// TODO: this needs to use lazy-array
			var newResults = [];

			function recurse(value) {
				if (value.forEach)
					value.forEach(recurse);
				else {
					newResults.push(value);
					if (property) {
						value = value[property];
						if (value && typeof value == "object")
							recurse(value);
					} else
						for (var i in value)
							if (value[i] && typeof value[i] == "object")
								recurse(value[i]);
				}
			}
			recurse(retrieve(this));
			return newResults;
		},
		aggregate: function() {
			var distinctives = [];
			var aggregates = [];
			for (var i = 0; i < arguments.length; i++) {
				var arg = arguments[i];
				if (typeof arg === "function")
					aggregates.push(arg);
				else
					distinctives.push(arg);
			}
			var distinctObjects = {};
			var dl = distinctives.length;
			this.forEach(function(object) {
				object = retrieve(object);
				var key = "";
				for (var i = 0; i < dl; i++)
					key += '/' + object[distinctives[i]];
				var arrayForKey = distinctObjects[key];
				if (!arrayForKey)
					arrayForKey = distinctObjects[key] = [];
				arrayForKey.push(object);
			});
			var al = aggregates.length;
			var newResults = [];
			for (var key in distinctObjects) {
				var arrayForKey = distinctObjects[key];
				var newObject = {};
				for (var i = 0; i < dl; i++) {
					var property = distinctives[i];
					newObject[property] = arrayForKey[0][property];
				}
				for (var i = 0; i < al; i++) {
					var aggregate = aggregates[i];
					newObject[i] = aggregate.call(arrayForKey);
				}
				newResults.push(newObject);
			}
			return newResults;
		},
		between: filter(function(value, range) {
			value = retrieve(value);
			return value >= range[0] && value < range[1];
		}),
		sum: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return a + b;
		}),
		mean: function(property) {
			return rql.ops.sum.call(this, property) / this.length;
		},
		max: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return Math.max(a, b);
		}),
		min: reducer(function(a, b) {
			a = retrieve(a);
			b = retrieve(b);
			return Math.min(a, b);
		}),
		count: function() {
			return this.length;
		},
		first: function() {
			return this[0];
		},
		last: function() {
			return this[this.length - 1];
		},
		random: function() {
			return this[Math.round(Math.random() * (this.length - 1))];
		},
		one: function() {
			if (this.length > 1)
				throw new Error("RQLError : More than one object found");
			return this[0];
		}
	};

	function rqlNodeToFunc(node) {
		if (typeof node === 'object') {
			var name = node.name;
			var args = node.args;
			if (node.forEach)
				return node.map(rqlNodeToFunc);
			else {
				var b = args[0],
					path = null;
				if (args.length == 2) {
					path = b;
					b = args[1];
				}
				var func = null;
				var isFilter = false;
				switch (name) {
					case "eq":
						isFilter = true;
						func = function eq(a) {
							return (retrieve(a, path) || undefined) === b;
						};
						break;
					case "ne":
						isFilter = true;
						func = function ne(a) {
							return (retrieve(a, path) || undefined) !== b;
						};
						break;
					case "le":
						isFilter = true;
						func = function le(a) {
							return (retrieve(a, path) || undefined) <= b;
						};
						break;
					case "ge":
						isFilter = true;
						func = function ge(a) {
							return (retrieve(a, path) || undefined) >= b;
						};
						break;
					case "lt":
						isFilter = true;
						func = function lt(a) {
							return (retrieve(a, path) || undefined) < b;
						};
						break;
					case "gt":
						isFilter = true;
						func = function gt(a) {
							return (retrieve(a, path) || undefined) > b;
						};
						break;
					default:
						var ops = rql.ops[name];
						if (!ops)
							throw new Error("RQLError : no operator found in rql with : " + name);
						if (args && args.length > 0) {
							args = args.map(rqlNodeToFunc);
							func = function() {
								return ops.apply(this, args);
							};
						} else
							func = function() {
								return ops.call(this);
							};
				}
				if (isFilter)
					return function() {
						var r = this.filter(func);
						return r;
					};
				else
					return func;
			}
		} else
			return node;
	}

	function retrieve(obj, path) {
		if (!path) {
			return obj;
		}
		var splitted = path.split(".");
		var tmp = obj;
		if (!tmp)
			return tmp;
		var len = splitted.length,
			needtype = false;
		if (len < 5) {
			var res;
			switch (len) {
				case 1:
					res = tmp[splitted[0]];
					break;
				case 2:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]];
					break;
				case 3:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]];
					break;
				case 4:
					res = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]] && tmp[splitted[0]][splitted[1]][splitted[2]][splitted[3]];
					break;
			}
			return res;
		}
		tmp = tmp[splitted[0]] && tmp[splitted[0]][splitted[1]] && tmp[splitted[0]][splitted[1]][splitted[2]] && tmp[splitted[0]][splitted[1]][splitted[2]][splitted[3]];
		if (typeof tmp === 'undefined')
			return undefined;
		var count = 4,
			part = splitted[count];
		while (part && tmp[part]) {
			tmp = tmp[part];
			part = splitted[++count];
		}
		if (count === len) {
			return tmp;
		}
		return undefined;
	}

	function filter(condition, not) {
		var filtr = function(property, second) {
			if (typeof second == "undefined") {
				second = property;
				property = undefined;
			}
			var args = arguments;
			var filtered = [];
			for (var i = 0, length = this.length; i < length; i++) {
				var item = this[i];
				if (condition(evaluateProperty(item, property), second))
					filtered.push(item);
			}
			return filtered;
		};
		filtr.condition = condition;
		return filtr;
	}

	function reducer(func) {
		return function(property) {
			if (property)
				return this.map(function(object) {
					return retrieve(object, property);
				}).reduce(func);
			else
				return this.reduce(func);
		};
	}

	function evaluateProperty(object, property) {
		if (property && property.forEach)
			return retrieve(object, decodeURIComponent(property));
		if (typeof property === 'undefined')
			return retrieve(object);
		return retrieve(object, decodeURIComponent(property));
	}
	module.exports = rql;
})();
