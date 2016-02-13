/**  
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 * View means something special in yamvish. there is no view instance as you could find in other MV* lib.
 * View here is just a __Template__ that will always produce a container that will be mounted in parent node.
 * (in dom output case of course, but it's transparent for string or twopass output)
 * 
 * Additionnaly, it will produce and hold its own context in produced container.
 * 
 * Exactly as what a classic view's instance would encapsulate (some nodes and a local context).
 *
 * But here finally, we just have simple nodes that could be mounted/unmounted and that refer to a local context. And nothing more.
 *
 * In place of View's class instanciation, you have View's template execution. 
 *
 * As a Template descendant, you could use it exactly as a normal template and everywhere a template do the job.
 *
 * As such descendant : 
 * You could add some methods in View api that will not be accessible to Template's instances.
 * But every methods added to Template prototype will be accessible in View's instance.
 *
 * It's interesting when you want to benefit from the container produced when View's template is executed. 
 * As yamvish-route do by implementing .route method in View api.
 *
 * All that sounds much more complex than when you use it... less is more... ;)
 */

var Template = require('./template');

function setContainer(context, container) {
	context.viewData.container = container;
}

function View(data, parent, path) {
	this.__yView__ = true;
	Template.call(this);
	this.newContext(data, parent, path)
		.context(function(context) {
			context.viewData = {};
		})
		.dom(setContainer)
		.secondPass(setContainer);
};

View.prototype = new Template();

// kill all attributes related methods
['attr', 'css', 'setClass', 'cl', 'visible', 'disabled', 'val']
.forEach(function(method) {
	View.prototype[method] = null;
});

module.exports = View;
