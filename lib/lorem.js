var y = require('../index');
//____________________________________________ LOREM

y.Template.prototype.lorem = function() {
	return this.text('Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.');
};

y.Template.prototype.lorempixelImg = function(width, height, gray, templ) {
	return this.img(y.utils.lorempixelURI(width, height, gray), templ);
};

y.utils.lorempixelURI = function(width, height, gray) {
	return 'http://lorempixel.com/' + (gray ? 'g/' : '/') + width + '/' + height;
};
