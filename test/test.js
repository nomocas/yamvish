/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 */
if (typeof require !== 'undefined')
	var chai = require("chai"),
		y = require("../dist/yamvish.full");

var expect = chai.expect;

describe("context", function() {
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

			context.then(function() {
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

			ctx.then(function(s) {
				res = y.interpolable('{{ title + deca(reu) + $parent.foo }}').output(ctx);
				done();
			});
		});

		it("should", function() {
			expect(res).to.equals("roooo-hello-lollipop-bar");
		});
	});
});
