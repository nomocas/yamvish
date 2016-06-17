/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 */
if (typeof require !== 'undefined') {
	var chai = require("./chai"),
		y = require("../index");
	require('../lib/output-engine/string');
	require('../lib/output-engine/twopass');
}
var expect = chai.expect;

describe("context base", function() {
	describe("set", function() {
		var context = new y.Context();
		context.set('hello', 'floupi');
		it("should", function() {
			expect(context.data.hello).to.equals('floupi');
		});
	});
	describe("get", function() {
		var context = new y.Context({
			test: {
				bar: true
			}
		});
		var res = context.get('test.bar');
		it("should", function() {
			expect(res).to.equals(true);
		});
	});
	describe("push", function() {
		var context = new y.Context({
			myCollec: []
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
				myCollec: []
			});
			context.subscribe('myCollec', function(value, type, path, index) {
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
				test: true
			});
			context.subscribe('test', function(value, type, path, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			});
			context.del('test');
		});
		it("should", function() {
			expect(res).to.equals('delete-test-undefined-test');
		});
	});
	describe("del in array and listen upward", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				myCollec: ['foo', 'bar']
			});
			context.subscribe('myCollec', function(value, type, path, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			}, true);
			context.del('myCollec.0');
		});
		it("should", function() {
			expect(res).to.equals('delete-0-undefined-0');
			expect(context.data.myCollec).to.deep.equal(['bar']);
		});
	});
	describe("toggle", function() {
		var res, context;
		before(function(done) {
			context = new y.Context({
				test: false
			});
			context.subscribe('test', function(value, type, path, index) {
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
				myCollec: []
			});
			context.subscribe('myCollec', function(value, type, path, index) {
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
				myCollec: ['bar', 'fleu']
			});
			context.subscribe('myCollec', function(value, type, path, index) {
				res = type + "-" + path + "-" + value + "-" + index;
				done();
			}, true);
			context.toggleInArray('myCollec', 'fleu');
		});
		it("should", function() {
			expect(res).to.equals('delete-1-undefined-1');
			expect(context.data.myCollec).to.deep.equal(['bar']);
		});
	});
	describe("dependent 1", function() {
		var context = new y.Context({
				foo: 'bar-',
				zoo: 'flup-',
				title: 'reu'
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
					foo: 'bar-',
					zoo: 'flup-',
					title: 'reu'
				})
				.dependent('test', ['foo', 'title'], function(foo, title) {
					return this.get('zoo') + foo + title;
				})
				.set('title', 'flappy')
				.set('foo', 'rully-');

			var interpolable = y.interpolable('{{ test }}');

			context.stabilised().then(function() {
				res2 = interpolable.output(context);
				done();
			});
		});

		it("should", function() {
			expect(res2).to.equals("flup-rully-flappy");
		});
	});
	describe("dependent with interpolable", function() {
		var context = new y.Context({
				foo: 'bar-',
				zoo: 'flup-',
				title: 'reu'
			})
			.dependent('test', '{{ foo + zoo + title }}');

		var interpolable = y.interpolable('{{ test }}');

		var res = interpolable.output(context);

		it("should", function() {
			expect(res).to.equals("bar-flup-reu");
		});
	});
});


describe("context's binds", function() {
	describe("object upward notification when sub properties change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('foo', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, true);

		context.set('foo.bar', 'zoo')

		it("should", function() {
			expect(res).to.deep.equal({ value: 'zoo', type: 'set', path: ['bar'], key: 'bar' });
		});
	});
	describe("object upward notification when object change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('foo', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, true);
		context.set('foo', { bar: 'zoo' });

		it("should", function() {
			expect(res).to.deep.equal({ value: { bar: 'zoo' }, type: 'set', path: [], key: 'foo' });
		});
	});
	describe("object upward notification when subobject change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('foo', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, true);
		context.set('foo.bar', 'zoo');

		it("should", function() {
			expect(res).to.deep.equal({ value: 'zoo', type: 'set', path: ['bar'], key: 'bar' });
		});
	});
	describe("object upward notification when sub-subobject change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: { zoo: 'yamvish' } }
		});

		context.subscribe('foo', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, true);
		context.set('foo.bar.zoo', 'yop');

		it("should", function() {
			expect(res).to.deep.equal({ value: 'yop', type: 'set', path: ['bar', 'zoo'], key: 'zoo' });
		});
	});
	describe("object downward notification when parent change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('foo.bar', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, false);

		context.set('foo', { bar: 'zoo' })

		it("should", function() {
			expect(res).to.deep.equal({ value: 'zoo', type: 'set', path: ['foo', 'bar'], key: 'bar' });
		});
	});

	describe("object downward notification when object change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('foo', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, false);

		context.set('foo', { bar: 'zoo' })

		it("should", function() {
			expect(res).to.deep.equal({ value: { bar: 'zoo' }, type: 'set', path: ['foo'], key: 'foo' });
		});
	});


	describe("root updward notification when child change", function() {
		var res;
		var context = new y.Context({
			foo: { bar: 'yamvish' }
		});

		context.subscribe('$this', function(value, type, path, key) {
			res = { value: value, type: type, path: path, key: key };
		}, true);

		context.set('foo', { bar: 'zoo' })

		it("should", function() {
			expect(res).to.deep.equal({ value: { bar: 'zoo' }, type: 'set', path: ['foo'], key: 'foo' });
		});
	});



});

describe("interpolable", function() {
	describe("interpolable filter", function() {
		var context = new y.Context({
			foo: 'yamvish'
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
		var parent = new y.Context({
			foo: '-bar'
		});

		var ctx = new y.Context({
			title: 'roooo',
			reu: 'lollipop',
			deca: function(arg) {
				return '-hello-' + arg;
			}
		}, parent);

		var res = y.interpolable('{{ title + deca(reu) + $parent.foo }}').output(ctx);

		it("should", function() {
			expect(res).to.equals("roooo-hello-lollipop-bar");
		});
	});



	// reset

	// get parent

	// subscribe parent

	// unsubscribe

	// subscribe *

	// notify/all

	// setAsync

	// pushAsync

});


describe("api", function() {
	describe("add api", function() {
		y.api.floup = {
			hello: function(arg) {
				return this.text('hello ' + arg);
			}
		};
		var templ = y().addApi('floup').hello('world');
		var res = templ.toHTMLString();
		it("should", function() {
			expect(res).to.equals("hello world");
		});
	});
	describe("use(api:method)", function() {
		y.api.floup = {
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


describe("context eacher : ", function() {
	describe("construct", function() {
		var ctx = new y.Context({
				collec: [1, 2, 3, 4, 5]
			}),
			eacher = new y.ContextEacher(ctx, 'collec');
		var result = eacher.children.map(function(i) {
			return i.data;
		});
		it("should", function() {
			expect(result).to.deep.equal([1, 2, 3, 4, 5]);
		});
	});
	describe("direct API usage : ", function() {
		describe("updateArray with less elements", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			eacher.updateArray([6, 7, 8]);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([6, 7, 8]);
			});
		});
		describe("updateArray with more elements", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			eacher.updateArray([6, 7, 8, 9, 10, 11, 12]);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([6, 7, 8, 9, 10, 11, 12]);
			});
		});
		describe("pushItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			eacher.pushItem(6);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 3, 4, 5, 6]);
			});
		});
		describe("deleteItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			eacher.deleteItem(2);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 4, 5]);
			});
		});
		describe("updateItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			eacher.updateItem('set', [2], 7, 2); // type, path, value, index
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 7, 4, 5]);
			});
		});
	});
	describe("through parent context binds : ", function() {
		describe("updateArray with less elements", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			ctx.set('collec', [6, 7, 8]);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([6, 7, 8]);
			});
		});
		describe("updateArray with more elements", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			ctx.set('collec', [6, 7, 8, 9, 10, 11, 12]);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([6, 7, 8, 9, 10, 11, 12]);
			});
		});
		describe("pushItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			ctx.push('collec', 6);
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 3, 4, 5, 6]);
			});
		});
		describe("deleteItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			ctx.del('collec.2');
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 4, 5]);
			});
		});
		describe("updateItem", function() {
			var ctx = new y.Context({
					collec: [1, 2, 3, 4, 5]
				}),
				eacher = new y.ContextEacher(ctx, 'collec');

			ctx.set('collec.2', 7); // type, path, value, index
			var result = eacher.children.map(function(i) {
				return i.data;
			});
			it("should", function() {
				expect(result).to.deep.equal([1, 2, 7, 4, 5]);
			});
		});
	});
});


describe("displace item : ", function() {
	describe("context only", function() {
		var ctx = new y.Context({
			collec: [1, 2, 3, 4, 5]
		});
		ctx.displaceItem('collec', { fromIndex: 0, toIndex: 3 });
		var result = ctx.data.collec;
		it("should", function() {
			expect(result).to.deep.equal([2, 3, 4, 1, 5]);
		});
	});
	describe("context and context eacher", function() {
		var ctx = new y.Context({
				collec: [1, 2, 3, 4, 5]
			}),
			eacher = new y.ContextEacher(ctx, 'collec');

		ctx.displaceItem('collec', { fromIndex: 0, toIndex: 3 });

		var result = eacher.children.map(function(i) {
			return i.data;
		});
		var indexes = eacher.children.map(function(i) {
			return i.index;
		});
		var paths = eacher.children.map(function(i) {
			return i.path;
		});
		it("should", function() {
			expect(result).to.deep.equal([2, 3, 4, 1, 5]);
			expect(indexes).to.deep.equal([0, 1, 2, 3, 4]);
			expect(paths).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4']);
		});
	});
});
describe("insert item : ", function() {
	describe("context only", function() {
		var ctx = new y.Context({
			collec: [1, 2, 3, 4, 5]
		});
		ctx.insertItem('collec', { data: 123, index: 3 });
		var result = ctx.data.collec;
		it("should", function() {
			expect(result).to.deep.equal([1, 2, 3, 123, 4, 5]);
		});
	});
	describe("context and context eacher", function() {
		var ctx = new y.Context({
				collec: [1, 2, 3, 4, 5]
			}),
			eacher = new y.ContextEacher(ctx, 'collec');

		ctx.insertItem('collec', { data: 123, index: 3 });

		var result = eacher.children.map(function(i) {
			return i.data;
		});
		var indexes = eacher.children.map(function(i) {
			return i.index;
		});
		var paths = eacher.children.map(function(i) {
			return i.path;
		});
		it("should", function() {
			expect(result).to.deep.equal([1, 2, 3, 123, 4, 5]);
			expect(indexes).to.deep.equal([0, 1, 2, 3, 4, 5]);
			expect(paths).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4', 'collec.5']);
		});
	});
});
describe("parent forwarding and contexts relations : ", function() {
	describe("context only from root to leaf (double child)", function() {
		var rootCtx = new y.Context({
			obj: { title: 'Hello World' }
		});

		var childContext1 = new y.Context(null, rootCtx, 'obj');
		var childContext2 = new y.Context(null, rootCtx, 'obj');

		childContext1.dependent('local1', ['title'], function(title) {
			if (title)
				return title.toUpperCase();
			return 'unset1';
		});
		childContext2.dependent('local2', ['title'], function(title) {
			if (title)
				return title.toLowerCase();
			return 'unset2';
		});

		rootCtx.set('obj.title', 'Foo Bar');

		var res = [rootCtx.data.obj.title, childContext1.data.local1, childContext2.data.local2];

		it("should", function() {
			expect(res).to.deep.equal(['Foo Bar', 'FOO BAR', 'foo bar']);
		});
	});
	describe("context only from leaf to root to leaf (double child)", function() {
		var rootCtx = new y.Context({
			obj: { title: 'Hello World' }
		});

		var childContext1 = new y.Context(null, rootCtx, 'obj');
		var childContext2 = new y.Context(null, rootCtx, 'obj');

		childContext1.dependent('local1', ['title'], function(title) {
			if (title)
				return title.toUpperCase();
			return 'unset1';
		});
		childContext2.dependent('local2', ['title'], function(title) {
			if (title)
				return title.toLowerCase();
			return 'unset2';
		});

		childContext1.set('title', 'Foo Bar');

		var res = [rootCtx.data.obj.title, childContext1.data.local1, childContext2.data.local2];

		it("should", function() {
			expect(res).to.deep.equal(['Foo Bar', 'FOO BAR', 'foo bar']);
		});
	});
	// CONTEXT EACHER
	describe("context and context eacher : from root to leaf (double eacher)", function() {
		var ctx = new y.Context({
				collec: [1, 2, 3, 4, 5]
			}),
			eacher1 = new y.ContextEacher(ctx, 'collec'),
			eacher2 = new y.ContextEacher(ctx, 'collec');
		ctx.insertItem('collec', { data: 123, index: 3 });

		var result1 = eacher1.children.map(function(i) {
			return i.data;
		});
		var indexes1 = eacher1.children.map(function(i) {
			return i.index;
		});
		var paths1 = eacher1.children.map(function(i) {
			return i.path;
		});
		var result2 = eacher2.children.map(function(i) {
			return i.data;
		});
		var indexes2 = eacher2.children.map(function(i) {
			return i.index;
		});
		var paths2 = eacher2.children.map(function(i) {
			return i.path;
		});
		it("should", function() {
			expect(result1).to.deep.equal([1, 2, 3, 123, 4, 5]);
			expect(indexes1).to.deep.equal([0, 1, 2, 3, 4, 5]);
			expect(paths1).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4', 'collec.5']);
			expect(result2).to.deep.equal([1, 2, 3, 123, 4, 5]);
			expect(indexes2).to.deep.equal([0, 1, 2, 3, 4, 5]);
			expect(paths2).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4', 'collec.5']);
		});
	});
	describe("context and double context eacher : from leaf to root to leaf", function() {
		var ctx = new y.Context({
				collec: [1, 2, 3, 4, 5]
			}),
			eacher1 = new y.ContextEacher(ctx, 'collec'),
			eacher2 = new y.ContextEacher(ctx, 'collec');
		eacher1.getItem(2).reset('weeee');

		var result1 = eacher1.children.map(function(i) {
			return i.data;
		});
		var indexes1 = eacher1.children.map(function(i) {
			return i.index;
		});
		var paths1 = eacher1.children.map(function(i) {
			return i.path;
		});
		var result2 = eacher2.children.map(function(i) {
			return i.data;
		});
		var indexes2 = eacher2.children.map(function(i) {
			return i.index;
		});
		var paths2 = eacher2.children.map(function(i) {
			return i.path;
		});
		it("should", function() {
			expect(result1).to.deep.equal([1, 2, 'weeee', 4, 5]);
			expect(indexes1).to.deep.equal([0, 1, 2, 3, 4]);
			expect(paths1).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4']);
			expect(result2).to.deep.equal([1, 2, 'weeee', 4, 5]);
			expect(indexes2).to.deep.equal([0, 1, 2, 3, 4]);
			expect(paths2).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4']);
		});
	});
	describe("context, childContext, context eacher : from eacher to root to child", function() {
		var ctx = new y.Context({
				collec: [1, 2, 'youuuu', 4, 5]
			}),
			eacher = new y.ContextEacher(ctx, 'collec'),
			childContext = new y.Context(null, ctx, 'collec');
		childContext.dependent('1', ['2'], function(item2) {
			if (item2)
				return item2.toUpperCase();
			return 'unset';
		});
		eacher.getItem(2).reset('weeee');

		var result1 = eacher.children.map(function(i) {
			return i.data;
		});
		var indexes1 = eacher.children.map(function(i) {
			return i.index;
		});
		var paths1 = eacher.children.map(function(i) {
			return i.path;
		});

		var childResult = childContext.get('1');

		it("should", function() {
			expect(result1).to.deep.equal([1, 'WEEEE', 'weeee', 4, 5]);
			expect(indexes1).to.deep.equal([0, 1, 2, 3, 4]);
			expect(paths1).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4']);
			expect(childResult).to.equals('WEEEE');
		});
	});
	describe("context, childContext, context eacher : from child to child to root to eacher", function() {
		var ctx = new y.Context({
				collec: [1, 2, 'youuu', 4, 5]
			}),
			eacher = new y.ContextEacher(ctx, 'collec'),
			childContext = new y.Context(null, ctx, 'collec');
		childContext.dependent('1', ['2'], function(item2) {
			if (item2)
				return item2.toUpperCase();
			return 'unset';
		});

		var eacherUpdateRes = null;
		eacher.getItem(1).subscribe('$this', function(value, type, path, key) {
			eacherUpdateRes = value + '__';
		});

		childContext.set('2', 'weeee');

		var result1 = eacher.children.map(function(i) {
			return i.data;
		});
		var indexes1 = eacher.children.map(function(i) {
			return i.index;
		});
		var paths1 = eacher.children.map(function(i) {
			return i.path;
		});

		var childResult = childContext.get('1');

		it("should", function() {
			expect(result1).to.deep.equal([1, 'WEEEE', 'weeee', 4, 5]);
			expect(indexes1).to.deep.equal([0, 1, 2, 3, 4]);
			expect(paths1).to.deep.equal(['collec.0', 'collec.1', 'collec.2', 'collec.3', 'collec.4']);
			expect(childResult).to.equals('WEEEE');
			expect(eacherUpdateRes).to.equals('WEEEE__');
		});
	});
});
