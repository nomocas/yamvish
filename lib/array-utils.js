/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 * Bunch of array utilities
 */

var utils = require('./utils');
// inspired from Kris Zyp original rql array sort.
utils.sort = function(array, attributes) {
	if (!attributes)
		attributes = ["+"];
	if (!attributes.forEach)
		attributes = [attributes];
	var terms = [];
	for (var i = 0; i < attributes.length; i++) {
		var sortAttribute = attributes[i];
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
	array.sort(function(a, b) {
		for (var term, i = 0; term = terms[i]; i++) {
			if (term.attribute === "") {
				if (a != b)
					return term.ascending == a > b ? 1 : -1;
				return;
			}
			if (a && a._deep_query_node_)
				a = a.value;
			if (b && b._deep_query_node_)
				b = b.value;
			var ar = utils.fromPath(a, term.attribute);
			var br = utils.fromPath(b, term.attribute);
			if (ar != br)
				return term.ascending == ar > br ? 1 : -1;
		}
		return 0;
	});
	return array;
};

utils.arrayUnique = function arrayUnique(arr1, uniqueOn) {
	if (!arr1.forEach)
		return arr1;
	var map = {};
	var count = 0;
	var arr = [];
	arr1.forEach(function(a) {
		var val = null;
		if (uniqueOn)
			val = utils.fromPath(a, uniqueOn);
		else if (a.uri)
			val = a.uri;
		if (val === null || val === undefined)
			val = String(a);
		if (typeof map[val] === 'undefined') {
			map[val] = true;
			arr.push(a);
		}
	});
	return arr;
};

utils.arrayFusion = function arrayFusion(arr1, arr2, uniqueOn) {
	var map = {};
	var count = 0;
	var arr = [];
	if (arr1 && arr1.length > 0)
		arr = arr.concat(arr1);
	arr.forEach(function(a) {
		var val = null;
		if (uniqueOn)
			val = utils.fromPath(a, uniqueOn);
		else if (a.uri)
			val = a.uri;
		if (val === null || val === undefined)
			val = String(a);
		map[val] = true;
	});
	arr2.forEach(function(a) {
		var val = null;
		if (uniqueOn)
			val = utils.fromPath(a, uniqueOn);
		else if (a.uri)
			val = a.uri;
		if (val === null || val === undefined)
			val = String(a);
		if (typeof map[val] === 'undefined')
			arr.push(a);
	});
	return arr;
};

utils.inArray = function inArray(what, inArr) {
	//console.log("inArray : what : "+JSON.stringify(what) + " - in : "+JSON.stringify(inArr));
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


utils.argToArr = Array.prototype.slice;

utils.arrayInsert = function(array, index) {
	array.splice.apply(array, [index, 0].concat(Array.prototype.slice.call(arguments, 1)));
	return array;
};

/**
 * work with object and array
 * @param  {[type]} obj      [description]
 * @param  {[type]} toRemove [description]
 * @return {[type]}          [description]
 */
utils.removeInside = function(obj, toRemove) {
	if (!toRemove.forEach)
		toRemove = [toRemove];
	var tr = {},
		item = null,
		key = null;
	for (var i = 0, len = toRemove.length; i < len; ++i) {
		item = toRemove[i];
		if (typeof item === 'object')
			key = item.id;
		else
			key = item;
		tr[key] = item;
	}
	if (obj.forEach) {
		for (var i = 0, len = obj.length; i < len; ++i) {
			item = obj[i];
			if (typeof item === 'object')
				key = item.id;
			else
				key = item;
			if (tr[key])
				obj.splice(i, 1);
		}
	} else {
		for (var i in obj) {
			item = obj[i];
			if (typeof item === 'object')
				key = item.id;
			else
				key = i;
			if (tr[key])
				delete obj[i];
		}
	}
	return obj;
};


module.exports = utils;
