/**  @author Gilles Coomans <gilles.coomans@gmail.com> */

var dependent = {
	func: function(firstName, lastName) {
		return firstName + ' ' + lastName;
	},
	dependencies: ['user.firstName', 'user.lastName']
}

function dependentMethod(dependencies, func) { // args : dep1, dep2, func
	return {
		__dependent_method__: true,
		producer: func,
		dependencies: dependencies,
		subscribeTo: function(context) {
			for (var i = 0, len = this.dependencies.length; i < len; ++i) {
				(this._binds = this._binds || []).push(context.subscribe('set', this.dependencies[i], function(type, value) {

				}));
			}
		},
		binds: []
	};
}
