/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 */
if (typeof require !== 'undefined')
	var chai = require("chai"),
		y = require("../index");

var expect = chai.expect;




describe("context", function() {
	describe("set", function() {
		var context = new y.Context();
		context.set('hello', 'floupi');
		it("should", function() {
			expect(context.data.hello).to.equals('floupi');
		});
	});
	describe("get", function() {
		var context = new y.Context({
			data: {
				test: {
					bar: true
				}
			}
		});
		var res = context.get('test.bar');
		it("should", function() {
			expect(res).to.equals(true);
		});
	});
	describe("push", function() {
		var context = new y.Context({
			data: {
				myCollec: []
			}
		});
		context.push('myCollec', 'floupi');
		it("should", function() {
			expect(context.data.myCollec).to.deep.equal(['floupi']);
		});
	});
	describe("push and listen", function() {
		var res;
		before(function(done) {
			var context = new y.Context({
				data: {
					myCollec: []
				}
			});
			context.subscribe('myCollec', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.push('myCollec', 'floupi');
		});
		it("should", function() {
			expect(res).to.equals('push-myCollec-floupi-0');
		});
	});
	describe("del and listen", function() {
		var res;
		before(function(done) {
			var context = new y.Context({
				data: {
					test: true
				}
			});
			context.subscribe('test', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.del('test');
		});
		it("should", function() {
			expect(res).to.equals('delete-test-true-test');
		});
	});
	describe("del in array and listen", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				data: {
					myCollec: ['foo', 'bar']
				}
			});
			context.subscribe('myCollec', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.del('myCollec.0');
		});
		it("should", function() {
			expect(res).to.equals('removeAt-myCollec-foo-0');
			expect(context.data.myCollec).to.deep.equal(['bar']);
		});
	});
	describe("toggle", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				data: {
					test: false
				}
			});
			context.subscribe('test', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.toggle('test');
		});
		it("should", function() {
			expect(res).to.equals('set-test-true-test');
			expect(context.data.test).to.equals(true);
		});
	});
	describe("toggleInArray set", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				data: {
					myCollec: []
				}
			});
			context.subscribe('myCollec', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.toggleInArray('myCollec', 'fleu');
		});
		it("should", function() {
			expect(res).to.equals('push-myCollec-fleu-0');
			expect(context.data.myCollec).to.deep.equal(['fleu']);
		});
	});
	describe("toggleInArray remove", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				data: {
					myCollec: ['bar', 'fleu']
				}
			});
			context.subscribe('myCollec', function(type, path, value, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.toggleInArray('myCollec', 'fleu');
		});
		it("should", function() {
			expect(res).to.equals('removeAt-myCollec-fleu-1');
			expect(context.data.myCollec).to.deep.equal(['bar']);
		});
	});
	describe("dependent 1", function() {
		var context = new y.Context({
				data: {
					foo: 'bar-',
					zoo: 'flup-',
					title: 'reu'
				}
			})
			.dependent('test', ['foo', 'title'], function(foo, title) {
				return this.get('zoo') + foo + title;
			});

		var interpolable = y.interpolable('{{ test }}');

		var res = interpolable.output(context);

		it("should", function() {
			expect(res).to.equals("flup-bar-reu");
		});
	});

	describe("dependent 2", function() {
		var res2;
		before(function(done) {
			var context = new y.Context({
					data: {
						foo: 'bar-',
						zoo: 'flup-',
						title: 'reu'
					}
				})
				.dependent('test', ['foo', 'title'], function(foo, title) {
					return this.get('zoo') + foo + title;
				})
				.set('title', 'flappy');

			var interpolable = y.interpolable('{{ test }}');

			context.done(function() {
				res2 = interpolable.output(context);
				done();
			});
		});


		it("should", function() {
			expect(res2).to.equals("flup-bar-flappy");
		});
	});

	describe("interpolable filter", function() {
		var context = new y.Context({
			data: {
				foo: 'yamvish'
			}
		});
		var inter = y.interpolable('{{ foo | upper() }} world');

		var res = inter.output(context);
		context.set('foo', 'flappy');
		var res2 = inter.output(context);

		it("should", function() {
			expect(res).to.equals("YAMVISH world");
			expect(res2).to.equals("FLAPPY world");
		});
	});


	describe("full expression", function() {
		var res;
		before(function(done) {
			var parent = new y.Context({
				data: {
					foo: '-bar'
				}
			});

			var ctx = new y.Context({
					parent: parent
				})
				.set('title', 'aaa@vbb.com')
				.set('reu', 'feeee')
				.set('deca', function(arg) {
					return '-hello-' + arg;
				})
				.set('title', 'roooo')
				.set('reu', 'lollipop');

			ctx.done(function(s) {
				res = y.interpolable('{{ title + deca(reu) + $parent.foo }}').output(ctx);
				done();
			});
		});

		it("should", function() {
			expect(res).to.equals("roooo-hello-lollipop-bar");
		});
	});


	/*
		reset

		get parent

		subscribe parent

		unsubscribe

		subscribe *

		notify/all

		setAsync

		pushAsync
	 */
});


describe("api", function() {
	describe("add api", function() {
		y.env().api.floup = {
			hello: function(arg) {
				return this.text('hello ' + arg);
			}
		};
		var templ = y().api('floup').hello('world');
		var res = templ.toHTMLString();
		it("should", function() {
			expect(res).to.equals("hello world");
		});
	});
	describe("use(api:method)", function() {
		y.env().api.floup = {
			hello: function(arg) {
				return this.text('hello ' + arg);
			}
		};
		var templ = y().use('floup:hello', 'bloupi');
		var res = templ.toHTMLString();
		it("should", function() {
			expect(res).to.equals("hello bloupi");
		});
	});
});
