/*
	Times : 
			nodejs : 23ms/1K (165ms/10K)  new node + new query + exec query + toString
			browser : 75ms/1K (790ms/10K)   new node + new query + exec query + toString
 
 			nodejs :  37 ms / 10K  					toString
			browser : 174 ms / 10K (18ms/1000) 		toString

			browser 	65 ms / 1K 					body.appendChild(render())
			browser 	60 ms / 1K 					body.innerHTML = toString())
 */

if (typeof require !== 'undefined')
	yamvish = require("./index");
var y = yamvish;
//______________________________________________ TESTS BROwSER
try {
	var q = y()
		//.set('test', 'world')
		//.set('deep', 'DEEEEEP')
		//.set('items', ["john", "biloud", "pirlouit"])
		//.set('amis', [{title:'MARCO'},{title:'CEDRIC'}])
		.attr('some', '{{ test }}')
		.setClass('zoo')
		.h(1,
			'hello {{ test }}',
			y().click('addItem')
		)
		.h(2, 'rooo')
		.div(
			y().setClass('haaaaaaaaaa', 'active')
			.a('/', 'a link')
			.ul(
				y().setClass('bloupiiiiiiii')
				.each('items', y().li('{{ $this }}'))
			)
			.ul(
				y().setClass('zzzzzzzzzzz')
				.each('amis', y().li(
					y().attr('fromParent', '{{ $parent.test }}'),
					'soooooooo {{ title }}'
				))
			)
			.div('{{ deep }} div')
			.span('deep inner span')
		);

	document.body.innerHTML = '';

	var context = new y.Context({
		// data
		test: 'world',
		deep: 'foo',
		active: false,
		items: ["john", "biloud", "pirlouit"],
		amis: [{
			title: 'MARCO'
		}, {
			title: 'CEDRIC'
		}]
	}, {
		// event handlers
		addItem: function(context, event) {
			context.push('items', Math.random());
		}
	});

	console.time("t");

	for (var i = 0; i < 100; ++i) {
		var o = new y.Virtual('div');
		q.call(o, context);
		document.body.appendChild(o.toElement());
	}

	context.set('active', true)
		.set('items.1', 'lollipop !')
		.set('test', 'HOOOO !')
		.push('items', 'johnetta')
		.push('amis', {
			title: 'philippe'
		})
		.del('items.2')
		.del('amis.1');

	console.timeEnd("t");

} catch (e) {
	console.log("error : ", e, e.stack);
}
/*

try {
	var context = new y.Context();
	var cb = function(type, value) {
		console.log("hello has been setted to :", value, type);
	};
  var cb2 = function(type, value) {
		console.log("hello.foo has been setted to :", value, type);
	};
	context.subscribe('hello', cb);
  var unsub = context.subscribe('hello.foo', cb2);
 
  console.time("obs");
	for (var i = 0; i < 1; ++i)
  {

    
  }
  context.reset({
		'hello': Math.random()
	});
  context.set('hello', { bar:true });
  
  context.set('hello.foo', 'blupi');

  context.set('hello', 'bloupi');
  
  
  unsub()
  context.set('hello.foo', 'blupzzzzzi');
  
  console.timeEnd("obs")
	console.log("obs : ", context)
	//
} catch (e) {
	console.log("error :", e);
}
	*/



/*

function MyClass(arg){
  this.arg = arg;
}

MyClass.prototype.foo = function(arg){
  console.log("MyClass.foo : this.arg : ", this.arg, " - arg : ", arg);
}

function MyClass2(arg, arg2){
  this.arg2 = arg2;
}

MyClass2.prototype.foo = function(arg){
  this._super(arg+'heeee');
  console.log("MyClass2.foo : this.arg2 : ", this.arg2, " - arg : ", arg);
}

var obj = {
  foo: function(arg){
    this._super(arg+'heeee');
    console.log("obj.foo : this.arg : ", this.arg," - this.arg2 : ", this.arg2, " - arg : ", arg);
  }
};

var Third = y.Class(MyClass, MyClass2, obj)


var third = new Third("hello", "world");

//third.foo("bar")



var Fourth = Third.extend({
  foo: function(arg){
    this._super(arg+'heeee');
    console.log("Fourth.foo : this.arg : ", this.arg," - this.arg2 : ", this.arg2, " - arg : ", arg);
  }
});

var fourth = new Fourth('bloupi');
fourth.foo('rooo');


 */
